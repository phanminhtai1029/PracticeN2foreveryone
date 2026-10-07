import { Hono } from 'hono';
import type { AppEnv } from './env';
import { requireUser } from './auth';
import { authRoutes } from './routes/auth';
import { examRoutes } from './routes/exams';
import { attemptRoutes } from './routes/attempts';
import { audioRoutes, serveR2 } from './routes/audio';

export const app = new Hono<AppEnv>();

app.route('/api/auth', authRoutes);
app.use('/api/*', async (c, next) => (c.req.path.startsWith('/api/auth/') ? next() : requireUser(c, next)));
app.route('/api/exams', examRoutes);
app.route('/api/attempts', attemptRoutes);
app.route('/api/audio', audioRoutes);
// Exam figures live in R2 (not in the public repo) under the same paths content/ uses: /exam-assets/<exam>/<file>.
app.get('/exam-assets/*', requireUser, (c) =>
  serveR2(c, decodeURIComponent(c.req.path.slice(1)), 'application/octet-stream'),
);
app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Lỗi máy chủ' }, 500);
});

export default { fetch: app.fetch } satisfies ExportedHandler<AppEnv['Bindings']>;
