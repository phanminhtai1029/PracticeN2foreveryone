import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { loadExam } from '../db';
import { gradeAttempt } from '../../shared/scoring';
import { PARTS, type Answers, type AttemptDetail, type AttemptListItem, type AttemptResult, type Part } from '../../shared/types';

interface AttemptRow {
  id: number;
  exam_id: string;
  parts_json: string;
  answers_json: string;
  result_json: string;
  started_at: number;
  submitted_at: number;
}

function parseBody(body: unknown): { examId: string; parts: Part[]; answers: Answers; startedAt: number } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.examId !== 'string' || typeof b.startedAt !== 'number') return null;
  if (!Array.isArray(b.parts) || b.parts.length === 0) return null;
  if (!b.parts.every((p) => (PARTS as unknown[]).includes(p))) return null;
  if (!b.answers || typeof b.answers !== 'object' || Array.isArray(b.answers)) return null;
  const answers: Answers = {};
  for (const [k, v] of Object.entries(b.answers)) if (typeof v === 'number') answers[k] = v;
  return { examId: b.examId, parts: [...new Set(b.parts as Part[])], answers, startedAt: b.startedAt };
}

export const attemptRoutes = new Hono<AppEnv>()
  .post('/', async (c) => {
    const input = parseBody(await c.req.json().catch(() => null));
    if (!input) return c.json({ error: 'invalid body' }, 400);
    const exam = await loadExam(c.env.DB, input.examId);
    if (!exam) return c.json({ error: 'exam not found' }, 404);

    const result = gradeAttempt(exam, input.parts, input.answers);
    const row = await c.env.DB.prepare(
      `INSERT INTO attempts (user_id, exam_id, parts_json, answers_json, result_json, started_at, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
      .bind(
        c.get('user').id,
        exam.id,
        JSON.stringify(input.parts),
        JSON.stringify(input.answers),
        JSON.stringify(result),
        input.startedAt,
        Date.now(),
      )
      .first<{ id: number }>();
    return c.json({ id: row!.id, result });
  })
  .get('/', async (c) => {
    const examId = c.req.query('examId');
    const stmt = examId
      ? c.env.DB.prepare(
          'SELECT * FROM attempts WHERE user_id = ? AND exam_id = ? ORDER BY submitted_at DESC LIMIT 50',
        ).bind(c.get('user').id, examId)
      : c.env.DB.prepare('SELECT * FROM attempts WHERE user_id = ? ORDER BY submitted_at DESC LIMIT 50').bind(
          c.get('user').id,
        );
    const { results } = await stmt.all<AttemptRow>();
    const items: AttemptListItem[] = results.map((r) => {
      const result = JSON.parse(r.result_json) as AttemptResult;
      return {
        id: r.id,
        examId: r.exam_id,
        parts: JSON.parse(r.parts_json),
        total: result.total,
        status: result.status,
        submittedAt: r.submitted_at,
      };
    });
    return c.json(items);
  })
  .get('/:id', async (c) => {
    const r = await c.env.DB.prepare('SELECT * FROM attempts WHERE id = ? AND user_id = ?')
      .bind(Number(c.req.param('id')), c.get('user').id)
      .first<AttemptRow>();
    if (!r) return c.json({ error: 'not found' }, 404);
    const detail: AttemptDetail = {
      id: r.id,
      examId: r.exam_id,
      parts: JSON.parse(r.parts_json),
      answers: JSON.parse(r.answers_json),
      result: JSON.parse(r.result_json),
      startedAt: r.started_at,
      submittedAt: r.submitted_at,
    };
    return c.json(detail);
  });
