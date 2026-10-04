import {
  GROUPS,
  PARTS,
  type Answers,
  type AttemptResult,
  type Exam,
  type ExamSummary,
  type GroupResult,
  type Part,
  type PartResult,
  type PublicExam,
  type QuestionReview,
} from './types';

export const PASS_TOTAL = 90;
export const PASS_GROUP_MIN = 19;
export const GROUP_MAX = 60;

const GROUP_PARTS = {
  language: ['vocab', 'grammar'],
  reading: ['reading'],
  listening: ['listening'],
} as const satisfies Record<string, Part[]>;

const MISSING_PARTS_REASON = {
  language: 'Cần làm cả Từ vựng và Ngữ pháp',
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

  const groups: GroupResult[] = GROUPS.map((group) => {
    const needed: readonly Part[] = GROUP_PARTS[group];
    if (!needed.every((p) => selected.has(p))) return { group, scaled: null, reason: MISSING_PARTS_REASON[group] };
    const prs = needed.map((p) => partResults.get(p)).filter((p): p is PartResult => !!p);
    if (prs.some((p) => p.ungraded > 0)) return { group, scaled: null, reason: 'Chưa có đáp án' };
    const max = prs.reduce((s, p) => s + p.maxWeighted, 0);
    if (max === 0) return { group, scaled: null, reason: 'Chưa có câu hỏi' };
    const got = prs.reduce((s, p) => s + p.weighted, 0);
    return { group, scaled: Math.round((got / max) * GROUP_MAX) };
  });

  const complete = groups.every((g) => g.scaled !== null);
  const total = complete ? groups.reduce((s, g) => s + (g.scaled ?? 0), 0) : null;
  const status: AttemptResult['status'] =
    total === null
      ? 'provisional'
      : total >= PASS_TOTAL && groups.every((g) => (g.scaled ?? 0) >= PASS_GROUP_MIN)
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
