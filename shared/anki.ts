// Turns an exam's word notebook into Anki notes. Pure: the .apkg file itself is written in shared/apkg.ts.
import { markupToText, parseMarkup, type MarkupNode } from './markup';
import type { GrammarNote, Level, Part, PublicExam, PublicMondai, StudyNotes, VocabNote } from './types';
import { PART_JP } from './types';

export type AnkiKind = 'vocab' | 'grammar';

export interface AnkiSelection {
  /** exam sections to take from; all of them when left out */
  parts?: Part[];
  kinds: AnkiKind[];
  /** empty means every level */
  levels: Level[];
}

export interface AnkiNote {
  /** what makes two notes the same card, across 問題 and across exams */
  key: string;
  /** in the order of the note type's fields */
  fields: string[];
  tags: string[];
}

export const ANKI_FIELDS: Record<AnkiKind, string[]> = {
  vocab: ['Word', 'Reading', 'HanViet', 'Meaning', 'POS', 'Level', 'Context', 'Source'],
  grammar: ['Pattern', 'Form', 'Meaning', 'Note', 'Example', 'ExampleVi', 'Level', 'Source'],
};

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Exam markup as the HTML an Anki field holds. */
export function markupToHtml(src: string): string {
  const walk = (nodes: MarkupNode[]): string =>
    nodes
      .map((n) => {
        switch (n.t) {
          case 'text':
            return escapeHtml(n.v);
          case 'br':
            return '<br>';
          case 'ruby':
            return `<ruby>${escapeHtml(n.base)}<rt>${escapeHtml(n.rt)}</rt></ruby>`;
          case 'u':
            return `<u>${walk(n.children)}</u>`;
          case 'b':
            return `<b>${walk(n.children)}</b>`;
        }
      })
      .join('');
  return walk(parseMarkup(src));
}

const KANJI_OR_KATAKANA = /[゠-ヿ一-鿿]/;
const HIRAGANA_END = /[ぁ-ゟ]$/;

/**
 * A sentence from the exam that shows the word in use, or '' when none can be found for certain.
 * Verbs and i-adjectives are matched on their stem so inflected forms count; short kana words are skipped
 * because they would match inside other words.
 */
function contextOf(v: VocabNote, m: PublicMondai): string {
  const base = v.word.replace(/〜/g, '');
  const inflects = /^(V|Aい)/.test(v.pos) && base.length > 1 && HIRAGANA_END.test(base);
  const stem = inflects ? base.slice(0, -1) : base;
  if (!KANJI_OR_KATAKANA.test(stem) && stem.length < 3) return '';

  const asked = m.questions.filter((q) => v.q?.includes(q.no));
  const sentences = (text?: string) => (text ?? '').split('\n').flatMap((line) => line.match(/[^。]+。?/g) ?? []);
  const candidates = [...asked.flatMap((q) => [q.stem, ...q.choices]), ...sentences(m.passage)];
  for (const c of candidates) {
    const plain = markupToText(c).trim();
    // a bare word (a kanji-choice, a heading) is not a sentence
    if (plain.includes(stem) && plain.length >= stem.length + 5 && plain.length <= 160) return markupToHtml(c.trim());
  }
  return '';
}

/** The exam as a tag and file name prefix, e.g. "N2-2024-07"; ids that already start with the level keep it once. */
export const examTag = (exam: Pick<PublicExam, 'id' | 'level'>) =>
  exam.id.toUpperCase().startsWith(`${exam.level}-`) ? exam.id.toUpperCase() : `${exam.level}-${exam.id}`;

const sourceOf = (exam: PublicExam, m: PublicMondai, q?: number[]) =>
  `${exam.title}, 問題${m.number}${m.title ?? ''}${q?.length ? `, câu ${q.join(', ')}` : ''}`;

/** One note per distinct word or pattern, taken from where it first appears. */
export function collectAnkiNotes(exam: PublicExam, notes: StudyNotes[], sel: AnkiSelection): Record<AnkiKind, AnkiNote[]> {
  const byMondai = new Map(notes.map((n) => [n.mondaiId, n]));
  const out: Record<AnkiKind, AnkiNote[]> = { vocab: [], grammar: [] };
  const seen = new Set<string>();
  const wanted = (level: Level) => !sel.levels.length || sel.levels.includes(level);
  const tagsOf = (m: PublicMondai, level: Level, kind: AnkiKind) => ['練習帳', examTag(exam), level, kind === 'vocab' ? '語彙' : '文法', `出題-${PART_JP[m.part].replace('・', '')}`];

  for (const m of exam.mondai) {
    const n = byMondai.get(m.id);
    if (!n || (sel.parts && !sel.parts.includes(m.part))) continue;
    if (sel.kinds.includes('vocab'))
      for (const v of n.vocab) {
        const key = `v|${v.word}|${v.reading ?? ''}`;
        if (seen.has(key) || !wanted(v.level)) continue;
        seen.add(key);
        out.vocab.push({
          key,
          fields: [escapeHtml(v.word), escapeHtml(v.reading ?? ''), escapeHtml(v.hanViet ?? ''), markupToHtml(v.meaning), escapeHtml(v.pos), v.level, contextOf(v, m), escapeHtml(sourceOf(exam, m, v.q))],
          tags: tagsOf(m, v.level, 'vocab'),
        });
      }
    if (sel.kinds.includes('grammar'))
      for (const g of n.grammar as GrammarNote[]) {
        const key = `g|${g.pattern}`;
        if (seen.has(key) || !wanted(g.level)) continue;
        seen.add(key);
        out.grammar.push({
          key,
          fields: [escapeHtml(g.pattern), escapeHtml(g.form), markupToHtml(g.meaning), markupToHtml(g.note ?? ''), markupToHtml(g.example), markupToHtml(g.exampleVi), g.level, escapeHtml(sourceOf(exam, m, g.q))],
          tags: tagsOf(m, g.level, 'grammar'),
        });
      }
  }
  return out;
}
