import { describe, it, expect, beforeEach, vi } from 'vitest';
import { app } from '../worker/index';
import { hashPassword } from '../worker/auth';
import { insertExamStatements } from '../worker/db';
import { createTestD1 } from './d1shim';
import { fixtureExam, ALL_RIGHT } from './fixtures';
import type { Env } from '../worker/env';

let env: Env;

async function addUser(username: string, password: string) {
  await env.DB.prepare('INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)')
    .bind(username, await hashPassword(password), 'user', Date.now())
    .run();
}

const req = (path: string, init: RequestInit = {}) => app.request(`http://localhost${path}`, init, env);
const json = (body: unknown, cookie?: string): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
});

async function login(username = 'alice', password = 'pw-alice') {
  const res = await req('/api/auth/login', json({ username, password }));
  const setCookie = res.headers.get('set-cookie') ?? '';
  return { res, cookie: setCookie.split(';')[0] };
}

beforeEach(async () => {
  env = { DB: createTestD1(), AUDIO: {} as R2Bucket };
  await env.DB.batch(insertExamStatements(env.DB, fixtureExam()));
  await addUser('alice', 'pw-alice');
  await addUser('bob', 'pw-bob');
});

describe('auth', () => {
  it('rejects requests without a session', async () => {
    expect((await req('/api/exams')).status).toBe(401);
  });

  it('rejects a wrong password', async () => {
    expect((await req('/api/auth/login', json({ username: 'alice', password: 'x' }))).status).toBe(401);
    expect((await req('/api/auth/login', json({ username: 'ghost', password: 'x' }))).status).toBe(401);
  });

  it('logs in with an HttpOnly cookie that is not Secure on http', async () => {
    const { res, cookie } = await login();
    expect(res.status).toBe(200);
    const sc = res.headers.get('set-cookie')!;
    expect(sc).toContain('HttpOnly');
    expect(sc).not.toContain('Secure');
    const me = await req('/api/auth/me', { headers: { cookie } });
    expect(await me.json()).toEqual({ user: { id: 1, username: 'alice', role: 'user' } });
  });

  it('hashes even for unknown usernames so timing does not reveal which exist', async () => {
    const spy = vi.spyOn(crypto.subtle, 'deriveBits');
    try {
      expect((await req('/api/auth/login', json({ username: 'ghost', password: 'x' }))).status).toBe(401);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('rate-limits login per username and per IP before checking the password', async () => {
    const counts = new Map<string, number>();
    env.LOGIN_LIMIT = {
      limit: async ({ key }) => {
        counts.set(key, (counts.get(key) ?? 0) + 1);
        return { success: counts.get(key)! <= 2 };
      },
    };
    const attempt = (username: string, ip: string) =>
      req('/api/auth/login', {
        ...json({ username, password: 'wrong' }),
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
      });
    expect((await attempt('alice', '1.1.1.1')).status).toBe(401);
    expect((await attempt('Alice', '2.2.2.2')).status).toBe(401);
    // Third try on the same username (case-insensitive) is blocked even from a new IP.
    const blocked = await attempt('alice', '3.3.3.3');
    expect(blocked.status).toBe(429);
    expect(((await blocked.json()) as { error: string }).error).toMatch(/quá nhiều/);
    // Same IP spraying different usernames is blocked too.
    expect((await attempt('bob', '1.1.1.1')).status).toBe(401);
    expect((await attempt('carol', '1.1.1.1')).status).toBe(429);

    const spy = vi.spyOn(crypto.subtle, 'deriveBits');
    try {
      await attempt('alice', '4.4.4.4');
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('locks out after 10 failed logins per username or per IP within 15 minutes (D1-backed)', async () => {
    const attempt = (username: string, password: string, ip: string) =>
      req('/api/auth/login', {
        ...json({ username, password }),
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
      });
    // Successful logins don't count toward the lockout.
    for (let i = 0; i < 3; i++) expect((await attempt('alice', 'pw-alice', '9.9.9.9')).status).toBe(200);
    // 10 failures for alice, each from a different IP.
    for (let i = 0; i < 10; i++) expect((await attempt('ALICE', 'wrong', `10.0.0.${i}`)).status).toBe(401);
    // Locked: even the right password from a fresh IP is refused, without running PBKDF2.
    const spy = vi.spyOn(crypto.subtle, 'deriveBits');
    try {
      const locked = await attempt('alice', 'pw-alice', '10.0.1.1');
      expect(locked.status).toBe(429);
      expect(((await locked.json()) as { error: string }).error).toMatch(/15 phút/);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
    // Other accounts are unaffected.
    expect((await attempt('bob', 'pw-bob', '10.0.1.2')).status).toBe(200);

    // One IP spraying different usernames is locked after 10 failures too.
    for (let i = 0; i < 10; i++) expect((await attempt(`user${i}`, 'x', '7.7.7.7')).status).toBe(401);
    expect((await attempt('bob', 'pw-bob', '7.7.7.7')).status).toBe(429);
  });

  it('forgets failed logins older than 15 minutes', async () => {
    const old = Math.floor(Date.now() / 1000) - 16 * 60;
    for (let i = 0; i < 10; i++) {
      await env.DB.prepare('INSERT INTO login_failures (key, at) VALUES (?, ?)').bind('user:alice', old).run();
    }
    expect((await login()).res.status).toBe(200);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM login_failures').first<{ n: number }>())!.n).toBe(0);
  });

  it('purges expired sessions on login', async () => {
    await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind('old', 1, 1).run();
    await login();
    expect(await env.DB.prepare('SELECT token FROM sessions WHERE token = ?').bind('old').first()).toBeNull();
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM sessions').first<{ n: number }>())!.n).toBe(1);
  });

  it('logout invalidates the session', async () => {
    const { cookie } = await login();
    await req('/api/auth/logout', { method: 'POST', headers: { cookie } });
    expect((await req('/api/exams', { headers: { cookie } })).status).toBe(401);
  });
});

describe('exams', () => {
  it('lists summaries', async () => {
    const { cookie } = await login();
    const list = (await (await req('/api/exams', { headers: { cookie } })).json()) as { id: string; parts: unknown }[];
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('fx');
    expect(list[0].parts).toEqual({
      vocab: { questions: 2 },
      grammar: { questions: 1 },
      reading: { questions: 1 },
      listening: { questions: 2 },
    });
  });

  it('serves an exam without answers', async () => {
    const { cookie } = await login();
    const res = await req('/api/exams/fx', { headers: { cookie } });
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toContain('"answer"');
    expect(JSON.parse(text).mondai).toHaveLength(4);
    expect((await req('/api/exams/nope', { headers: { cookie } })).status).toBe(404);
  });
});

describe('attempts', () => {
  it('grades, persists and scopes to the owner', async () => {
    const { cookie } = await login();
    const res = await req(
      '/api/attempts',
      json({ examId: 'fx', parts: ['vocab', 'grammar'], answers: { ...ALL_RIGHT, bogus: 3 }, startedAt: 1000 }, cookie),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: number; result: { groups: { group: string; scaled: number | null }[] } };
    expect(body.result.groups.find((g) => g.group === 'language')!.scaled).toBe(60);

    const detail = (await (await req(`/api/attempts/${body.id}`, { headers: { cookie } })).json()) as {
      result: unknown;
      parts: string[];
    };
    expect(detail.result).toEqual(body.result);
    expect(detail.parts).toEqual(['vocab', 'grammar']);

    const history = (await (await req('/api/attempts?examId=fx', { headers: { cookie } })).json()) as unknown[];
    expect(history).toHaveLength(1);

    const bob = await login('bob', 'pw-bob');
    expect((await req(`/api/attempts/${body.id}`, { headers: { cookie: bob.cookie } })).status).toBe(404);
  });

  it('rejects invalid bodies', async () => {
    const { cookie } = await login();
    for (const bad of [
      { examId: 'fx', parts: [], answers: {}, startedAt: 1 },
      { examId: 'fx', parts: ['dance'], answers: {}, startedAt: 1 },
      { examId: 'fx', parts: ['vocab'], answers: 'x', startedAt: 1 },
      { examId: 'nope', parts: ['vocab'], answers: {}, startedAt: 1 },
    ]) {
      const res = await req('/api/attempts', json(bad, cookie));
      expect([400, 404]).toContain(res.status);
    }
  });
});
