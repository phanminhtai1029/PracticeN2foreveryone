import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../env';
import {
  DUMMY_HASH,
  SESSION_COOKIE,
  SESSION_TTL_SEC,
  clearLoginFailures,
  createSession,
  isLockedOut,
  recordLoginFailure,
  requireUser,
  verifyPassword,
} from '../auth';

export const authRoutes = new Hono<AppEnv>()
  .post('/login', async (c) => {
    const body = await c.req.json().catch(() => null);
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!username || !password) return c.json({ error: 'Thiếu tên đăng nhập hoặc mật khẩu' }, 400);

    // Throttle per account (stops guessing one password from many IPs) and per IP (stops spraying many accounts).
    const userKey = `user:${username.toLowerCase()}`;
    const keys = [userKey, `ip:${c.req.header('cf-connecting-ip') ?? 'unknown'}`];
    // Cheap first layer: Workers rate limit binding (all attempts, per location, approximate).
    const limiter = c.env.LOGIN_LIMIT;
    if (limiter) {
      const outcomes = await Promise.all(keys.map((key) => limiter.limit({ key })));
      if (outcomes.some((o) => !o.success)) {
        return c.json({ error: 'Đăng nhập sai quá nhiều lần. Đợi 1 phút rồi thử lại.' }, 429);
      }
    }
    // Exact second layer: failed attempts recorded in D1. Checked before hashing so a lockout costs no PBKDF2.
    if (await isLockedOut(c.env.DB, keys)) {
      return c.json({ error: 'Đăng nhập sai quá nhiều lần. Đợi 15 phút rồi thử lại.' }, 429);
    }

    const user = await c.env.DB.prepare('SELECT id, username, role, password_hash FROM users WHERE username = ?')
      .bind(username)
      .first<{ id: number; username: string; role: string; password_hash: string }>();
    const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !ok) {
      await recordLoginFailure(c.env.DB, keys);
      return c.json({ error: 'Sai tên đăng nhập hoặc mật khẩu' }, 401);
    }

    await clearLoginFailures(c.env.DB, userKey);
    const token = await createSession(c.env.DB, user.id);
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: new URL(c.req.url).protocol === 'https:',
      path: '/',
      maxAge: SESSION_TTL_SEC,
    });
    return c.json({ user: { id: user.id, username: user.username, role: user.role } });
  })
  .post('/logout', async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  })
  .get('/me', requireUser, (c) => c.json({ user: c.get('user') }));
