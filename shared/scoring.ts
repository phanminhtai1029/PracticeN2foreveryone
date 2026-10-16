import {
  PARTS,
  type Answers,
  type AttemptResult,
  type Exam,
  type ExamSummary,
  type Group,
  type GroupResult,
  type Part,
  type PartResult,
  type PublicExam,
  type QuestionReview,
} from './types';

/** A scored section of the score report, out of `max`, with its own minimum to pass. */
export interface Section {
  group: Group;
  parts: Part[];
  max: number;
  min: number;
}

/** N1-N3 report three 60-point sections; N4 and N5 merge language knowledge and reading into one of 120. */
const THREE_SECTIONS: Section[] = [
  { group: 'language', parts: ['vocab', 'grammar'], max: 60, min: 19 },
  { group: 'reading', parts: ['reading'], max: 60, min: 19 },
  { group: 'listening', parts: ['listening'], max: 60, min: 19 },
];
const TWO_SECTIONS: Section[] = [
  { group: 'languageReading', parts: ['vocab', 'grammar', 'reading'], max: 120, min: 38 },
  { group: 'listening', parts: ['listening'], max: 60, min: 19 },
];
export const sectionsOf = (level: string): Section[] => (level === 'N4' || level === 'N5' ? TWO_SECTIONS : THREE_SECTIONS);

/** Overall pass mark out of 180. */
const PASS_TOTAL_BY_LEVEL: Record<string, number> = { N1: 100, N2: 90, N3: 95, N4: 90, N5: 80 };
export const passTotal = (level: string) => PASS_TOTAL_BY_LEVEL[level] ?? 90;
export const TOTAL_MAX = 180;

const MISSING_PARTS_REASON: Record<Group, string> = {
  language: 'Cần làm cả Từ vựng và Ngữ pháp',
  languageReading: 'Cần làm cả Từ vựng, Ngữ pháp và Đọc hiểu',
  reading: 'Chưa làm phần này',
  listening: 'Chưa làm phần này',
};

function validChoice(value: unknown, choiceCount: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= choiceCount ? value : null;
}

export function gradeAttempt(exam: Exam, parts: Part[], answers: Answers): AttemptResult {
  const selected = new Set(parts);
  const partResults = new Map<Part, PartResult>();
  const review: QuestionReview[] = [];

  for (const m of exam.mondai) {
    if (!selected.has(m.part)) continue;
    let pr = partResults.get(m.part);
    if (!pr) {
      pr = { part: m.part, correct: 0, total: 0, answered: 0, ungraded: 0, weighted: 0, maxWeighted: 0 };
      partResults.set(m.part, pr);
    }
    for (const q of m.questions) {
      const chosen = validChoice(answers[q.id], q.choiceCount);
      if (chosen !== null) pr.answered++;
      if (q.answer === null) {
        pr.ungraded++;
        review.push({ id: q.id, part: m.part, chosen, answer: null, correct: null });
        continue;
      }
      const correct = chosen === q.answer;
      pr.total++;
      pr.maxWeighted += m.weight;
      if (correct) {
        pr.correct++;
        pr.weighted += m.weight;
      }
      review.push({ id: q.id, part: m.part, chosen, answer: q.answer, correct });
    }
  }

  const sections = sectionsOf(exam.level);
  const groups: GroupResult[] = sections.map(({ group, parts: needed, max: scale }) => {
    if (!needed.every((p) => selected.has(p))) return { group, scaled: null, reason: MISSING_PARTS_REASON[group] };
    const prs = needed.map((p) => partResults.get(p)).filter((p): p is PartResult => !!p);
    if (prs.some((p) => p.ungraded > 0)) return { group, scaled: null, reason: 'Chưa có đáp án' };
    const max = prs.reduce((s, p) => s + p.maxWeighted, 0);
    if (max === 0) return { group, scaled: null, reason: 'Chưa có câu hỏi' };
    const got = prs.reduce((s, p) => s + p.weighted, 0);
    return { group, scaled: Math.round((got / max) * scale) };
  });

  const complete = groups.every((g) => g.scaled !== null);
  const total = complete ? groups.reduce((s, g) => s + (g.scaled ?? 0), 0) : null;
  const status: AttemptResult['status'] =
    total === null
      ? 'provisional'
      : total >= passTotal(exam.level) && groups.every((g, i) => (g.scaled ?? 0) >= sections[i].min)
        ? 'pass'
        : 'fail';

  return {
    parts: PARTS.filter((p) => partResults.has(p)).map((p) => partResults.get(p)!),
    groups,
    total,
    status,
    review,
  };
}

export function toPublicExam(exam: Exam): PublicExam {
  return {
    ...exam,
    mondai: exam.mondai.map((m) => ({
      ...m,
      questions: m.questions.map(({ answer: _a, answerVerified: _v, answerNote: _n, ...rest }) => rest),
    })),
  };
}

export function summarizeExam(exam: Exam): ExamSummary {
  const parts = Object.fromEntries(PARTS.map((p) => [p, { questions: 0 }])) as ExamSummary['parts'];
  for (const m of exam.mondai) parts[m.part].questions += m.questions.length;
  return {
    id: exam.id,
    title: exam.title,
    level: exam.level,
    hasAudio: !!exam.audio,
    timeLimits: exam.timeLimits,
    audioDurationSec: exam.audio?.durationSec ?? null,
    parts,
  };
}
