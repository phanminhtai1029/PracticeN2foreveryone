import { describe, it, expect, beforeEach } from 'vitest';
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
