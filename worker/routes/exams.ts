import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { listExams, loadExam, loadNotes } from '../db';
import { summarizeExam, toPublicExam } from '../../shared/scoring';
import type { StudyNotes } from '../../shared/types';

export const examRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json((await listExams(c.env.DB)).map(summarizeExam)))
  .get('/:id', async (c) => {
    const exam = await loadExam(c.env.DB, c.req.param('id'));
    if (!exam) return c.json({ error: 'not found' }, 404);
    return c.json(toPublicExam(exam));
  })
  // The word list is open before an attempt; the worked answers are not (see /api/attempts/:id/notes).
  .get('/:id/study', async (c) => {
    const notes = await loadNotes(c.env.DB, c.req.param('id'));
    return c.json(notes.map(({ mondaiId, vocab, grammar }): StudyNotes => ({ mondaiId, vocab, grammar })));
  });
