import { Hono } from 'hono';
import type { AppEnv } from './env';
import { requireUser } from './auth';
import { authRoutes } from './routes/auth';
import { examRoutes } from './routes/exams';
import { attemptRoutes } from './routes/attempts';
import { audioRoutes } from './routes/audio';

export const app = new Hono<AppEnv>();

app.route('/api/auth', authRoutes);
app.use('/api/*', async (c, next) => (c.req.path.startsWith('/api/auth/') ? next() : requireUser(c, next)));
app.route('/api/exams', examRoutes);
app.route('/api/attempts', attemptRoutes);
app.route('/api/audio', audioRoutes);
app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Lỗi máy chủ' }, 500);
});

export default { fetch: app.fetch } satisfies ExportedHandler<AppEnv['Bindings']>;
