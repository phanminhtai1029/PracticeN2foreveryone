// Validate content/exams/*/exam.json and load them into D1.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Exam } from '../shared/types';
import { PARTS } from '../shared/types';
import { wrangler } from './wrangler';

const root = join(import.meta.dirname, '..');
const examsDir = join(root, 'content', 'exams');

function validate(exam: Exam, file: string) {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const m of exam.mondai) {
    if (!PARTS.includes(m.part)) errors.push(`${m.id}: bad part ${m.part}`);
    if (!(m.weight > 0)) errors.push(`${m.id}: weight must be > 0`);
    for (const q of m.questions) {
      if (ids.has(q.id)) errors.push(`duplicate question id ${q.id}`);
      ids.add(q.id);
      if (q.choices.length && q.choices.length !== q.choiceCount) errors.push(`${q.id}: choices/choiceCount mismatch`);
      if (q.answer !== null && !(Number.isInteger(q.answer) && q.answer >= 1 && q.answer <= q.choiceCount))
        errors.push(`${q.id}: answer out of range`);
    }
  }
  if (errors.length) throw new Error(`${file}:\n  ${errors.join('\n  ')}`);
}

const sqlStr = (s: string) => `'${s.replace(/'/g, "''")}'`;
const lines: string[] = [];
for (const id of readdirSync(examsDir)) {
  const file = join(examsDir, id, 'exam.json');
  if (!existsSync(file)) continue;
  const exam = JSON.parse(readFileSync(file, 'utf8')) as Exam;
  validate(exam, file);
  const { mondai, ...meta } = exam;
  lines.push(`DELETE FROM exam_mondai WHERE exam_id = ${sqlStr(exam.id)};`);
  lines.push(`DELETE FROM exams WHERE id = ${sqlStr(exam.id)};`);
  lines.push(
    `INSERT INTO exams (id, title, level, sort_order, meta_json) VALUES (${sqlStr(exam.id)}, ${sqlStr(exam.title)}, ${sqlStr(exam.level)}, ${exam.sortOrder ?? 0}, ${sqlStr(JSON.stringify(meta))});`,
  );
  mondai.forEach((m, ord) =>
    lines.push(`INSERT INTO exam_mondai (exam_id, ord, data_json) VALUES (${sqlStr(exam.id)}, ${ord}, ${sqlStr(JSON.stringify(m))});`),
  );
  console.log(`✓ ${exam.id}: ${mondai.length} mondai, ${mondai.reduce((s, m) => s + m.questions.length, 0)} questions`);
}

mkdirSync(join(root, '.wrangler'), { recursive: true });
const out = join(root, '.wrangler', 'seed.sql');
writeFileSync(out, lines.join('\n') + '\n');
wrangler(['d1', 'execute', 'n2db', '--file', out, '--yes']);
