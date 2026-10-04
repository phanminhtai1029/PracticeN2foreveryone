import type { Exam, Mondai } from '../shared/types';

type MetaJson = Omit<Exam, 'mondai'>;

/** Statements that (re)insert one exam. Used by the seed script and tests. */
export function insertExamStatements(db: D1Database, exam: Exam): D1PreparedStatement[] {
  const { mondai, ...meta } = exam;
  return [
    db.prepare('DELETE FROM exams WHERE id = ?').bind(exam.id),
    db.prepare('DELETE FROM exam_mondai WHERE exam_id = ?').bind(exam.id),
    db
      .prepare('INSERT INTO exams (id, title, level, sort_order, meta_json) VALUES (?, ?, ?, ?, ?)')
      .bind(exam.id, exam.title, exam.level, exam.sortOrder ?? 0, JSON.stringify(meta)),
    ...mondai.map((m, ord) =>
      db.prepare('INSERT INTO exam_mondai (exam_id, ord, data_json) VALUES (?, ?, ?)').bind(exam.id, ord, JSON.stringify(m)),
    ),
  ];
}

export async function loadExam(db: D1Database, id: string): Promise<Exam | null> {
  const row = await db.prepare('SELECT meta_json FROM exams WHERE id = ?').bind(id).first<{ meta_json: string }>();
  if (!row) return null;
  const { results } = await db
    .prepare('SELECT data_json FROM exam_mondai WHERE exam_id = ? ORDER BY ord')
    .bind(id)
    .all<{ data_json: string }>();
  const meta = JSON.parse(row.meta_json) as MetaJson;
  return { ...meta, mondai: results.map((r) => JSON.parse(r.data_json) as Mondai) };
}

export async function listExams(db: D1Database): Promise<Exam[]> {
  const { results } = await db.prepare('SELECT id FROM exams ORDER BY sort_order DESC, id DESC').all<{ id: string }>();
  const exams = await Promise.all(results.map((r) => loadExam(db, r.id)));
  return exams.filter((e): e is Exam => !!e);
}
