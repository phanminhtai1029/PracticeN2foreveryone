import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../env';
import { SESSION_COOKIE, SESSION_TTL_SEC, createSession, requireUser, verifyPassword } from '../auth';

export const authRoutes = new Hono<AppEnv>()
  .post('/login', async (c) => {
    const body = await c.req.json().catch(() => null);
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!username || !password) return c.json({ error: 'Thiếu tên đăng nhập hoặc mật khẩu' }, 400);

    const user = await c.env.DB.prepare('SELECT id, username, role, password_hash FROM users WHERE username = ?')
      .bind(username)
      .first<{ id: number; username: string; role: string; password_hash: string }>();
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return c.json({ error: 'Sai tên đăng nhập hoặc mật khẩu' }, 401);
    }

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
