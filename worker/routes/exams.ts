import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { listExams, loadExam } from '../db';
import { summarizeExam, toPublicExam } from '../../shared/scoring';

export const examRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json((await listExams(c.env.DB)).map(summarizeExam)))
  .get('/:id', async (c) => {
    const exam = await loadExam(c.env.DB, c.req.param('id'));
    if (!exam) return c.json({ error: 'not found' }, 404);
    return c.json(toPublicExam(exam));
  });
