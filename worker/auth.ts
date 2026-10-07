import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppEnv } from './env';

// Workers caps PBKDF2 at 100k iterations.
const ITERATIONS = 100_000;
export const SESSION_COOKIE = 'sid';
export const SESSION_TTL_SEC = 30 * 24 * 3600;

const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await derive(password, salt, ITERATIONS))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iter || !salt || !hash) return false;
  try {
    const actual = new Uint8Array(await derive(password, unb64(salt), Number(iter)));
    const expected = unb64(hash);
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

export const LOCKOUT_MAX_FAILURES = 10;
export const LOCKOUT_WINDOW_SEC = 15 * 60;

/** True if any key has LOCKOUT_MAX_FAILURES failed logins inside the window. */
export async function isLockedOut(db: D1Database, keys: string[]): Promise<boolean> {
  const since = Math.floor(Date.now() / 1000) - LOCKOUT_WINDOW_SEC;
  const { results } = await db
    .prepare(`SELECT COUNT(*) AS n FROM login_failures WHERE key IN (${keys.map(() => '?').join(', ')}) AND at > ? GROUP BY key`)
    .bind(...keys, since)
    .all<{ n: number }>();
  return results.some((r) => r.n >= LOCKOUT_MAX_FAILURES);
}

export async function recordLoginFailure(db: D1Database, keys: string[]): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.batch(keys.map((k) => db.prepare('INSERT INTO login_failures (key, at) VALUES (?, ?)').bind(k, now)));
}

/** On success: forget this user's failures and drop anything outside the window. */
export async function clearLoginFailures(db: D1Database, userKey: string): Promise<void> {
  const since = Math.floor(Date.now() / 1000) - LOCKOUT_WINDOW_SEC;
  await db.prepare('DELETE FROM login_failures WHERE key = ? OR at <= ?').bind(userKey, since).run();
}

// Verified against when the username doesn't exist, so a miss costs the same PBKDF2 work as a hit.
export const DUMMY_HASH = `pbkdf2$${ITERATIONS}$${b64(new Uint8Array(16))}$${b64(new Uint8Array(32))}`;

export async function createSession(db: D1Database, userId: number): Promise<string> {
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const now = Math.floor(Date.now() / 1000);
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, userId, now + SESSION_TTL_SEC),
  ]);
  return token;
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: 'unauthorized' }, 401);
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.username, u.role FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
  )
    .bind(token, Math.floor(Date.now() / 1000))
    .first<{ id: number; username: string; role: string }>();
  if (!row) return c.json({ error: 'unauthorized' }, 401);
  c.set('user', row);
  await next();
};
