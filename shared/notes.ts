import type { Exam, MondaiNotes } from './types';
import { LEVELS } from './types';

const lines = (s: string) => s.split('\n').length;

/** Problems in one exam's notes, each prefixed with the 問題 or question it belongs to. Empty when the notes are sound. */
export function validateNotes(exam: Exam, notes: MondaiNotes[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const n of notes) {
    const at = (msg: string) => errors.push(`${n.mondaiId}: ${msg}`);
    const m = exam.mondai.find((x) => x.id === n.mondaiId);
    if (!m) {
      at('no such mondai in the exam');
      continue;
    }
    if (seen.has(n.mondaiId)) at('notes given twice');
    seen.add(n.mondaiId);
    if (!n.instructionVi?.trim()) at('instructionVi is empty');

    if (!!m.passage !== !!n.passageVi) at(m.passage ? 'passageVi is missing' : 'passageVi given but the mondai has no passage');
    else if (m.passage && lines(m.passage) !== lines(n.passageVi!))
      at(`passageVi has ${lines(n.passageVi!)} lines, the passage has ${lines(m.passage)}`);

    const ids = m.questions.map((q) => q.id);
    const noted = (n.questions ?? []).map((q) => q.id);
    for (const id of ids) if (!noted.includes(id)) at(`question ${id} has no note`);
    for (const q of n.questions ?? []) {
      const src = m.questions.find((x) => x.id === q.id);
      if (!src) {
        at(`note for unknown question ${q.id}`);
        continue;
      }
      if (!q.stemVi?.trim()) at(`${q.id}: stemVi is empty`);
      if (!q.explain?.trim()) at(`${q.id}: explain is empty`);
      if (q.choices?.length !== src.choiceCount) at(`${q.id}: ${q.choices?.length ?? 0} choice notes, expected ${src.choiceCount}`);
      else if (q.choices.some((c) => !c.vi?.trim())) at(`${q.id}: a choice has no translation`);
      if (!!q.script !== !!q.scriptVi) at(`${q.id}: script and scriptVi come together`);
      else if (q.script && lines(q.script) !== lines(q.scriptVi!)) at(`${q.id}: scriptVi has ${lines(q.scriptVi!)} lines, the script has ${lines(q.script)}`);
    }

    const nos = new Set(m.questions.map((q) => q.no));
    const badQ = (q?: number[]) => q?.some((no) => !nos.has(no));
    (n.vocab ?? []).forEach((v, i) => {
      if (!v.word?.trim() || !v.pos?.trim() || !v.meaning?.trim()) at(`vocab[${i}] ${v.word ?? ''}: word, pos and meaning are required`);
      if (!LEVELS.includes(v.level)) at(`vocab[${i}] ${v.word}: bad level ${v.level}`);
      if (badQ(v.q)) at(`vocab[${i}] ${v.word}: q refers to a question outside this mondai`);
    });
    (n.grammar ?? []).forEach((g, i) => {
      if (!g.pattern?.trim() || !g.form?.trim() || !g.meaning?.trim() || !g.example?.trim() || !g.exampleVi?.trim())
        at(`grammar[${i}] ${g.pattern ?? ''}: pattern, form, meaning, example and exampleVi are required`);
      if (!LEVELS.includes(g.level)) at(`grammar[${i}] ${g.pattern}: bad level ${g.level}`);
      if (badQ(g.q)) at(`grammar[${i}] ${g.pattern}: q refers to a question outside this mondai`);
    });
    if (!Array.isArray(n.vocab) || !Array.isArray(n.grammar)) at('vocab and grammar must be arrays');
  }
  return errors;
}
