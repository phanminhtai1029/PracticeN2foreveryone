import { describe, it, expect } from 'vitest';
import { gradeAttempt, toPublicExam, summarizeExam } from '../shared/scoring';
import { fixtureExam, ALL_RIGHT } from './fixtures';

describe('gradeAttempt', () => {
  it('scores only the selected parts; partial language group is not scaled', () => {
    const r = gradeAttempt(fixtureExam(), ['vocab'], { v1: 1, v2: 1, g1: 3 });
    expect(r.parts).toEqual([
      { part: 'vocab', correct: 1, total: 2, answered: 2, ungraded: 0, weighted: 1, maxWeighted: 2 },
    ]);
    const lang = r.groups.find((g) => g.group === 'language')!;
    expect(lang.scaled).toBeNull();
    expect(lang.reason).toBe('Cần làm cả Từ vựng và Ngữ pháp');
    expect(r.total).toBeNull();
    expect(r.status).toBe('provisional');
    expect(r.review.map((x) => x.id)).toEqual(['v1', 'v2']);
  });

  it('full test with ungraded listening is provisional', () => {
    const r = gradeAttempt(fixtureExam(), ['vocab', 'grammar', 'reading', 'listening'], { ...ALL_RIGHT, l1: 1 });
    const by = Object.fromEntries(r.groups.map((g) => [g.group, g]));
    expect(by.language.scaled).toBe(60);
    expect(by.reading.scaled).toBe(60);
    expect(by.listening.scaled).toBeNull();
    expect(by.listening.reason).toBe('Chưa có đáp án');
    const l = r.parts.find((p) => p.part === 'listening')!;
    expect(l).toMatchObject({ correct: 0, total: 0, answered: 1, ungraded: 2, maxWeighted: 0 });
    expect(r.review.find((x) => x.id === 'l1')).toEqual({ id: 'l1', part: 'listening', chosen: 1, answer: null, correct: null });
    expect(r.total).toBeNull();
    expect(r.status).toBe('provisional');
  });

  it('pass when everything is right', () => {
    const r = gradeAttempt(fixtureExam([1, 2]), ['vocab', 'grammar', 'reading', 'listening'], { ...ALL_RIGHT, l1: 1, l2: 2 });
    expect(r.total).toBe(180);
    expect(r.status).toBe('pass');
  });

  it('fail when a group is below 19 even if total >= 90', () => {
    // reading wrong → reading 0; language 60, listening 60 → total 120 but reading < 19
    const r = gradeAttempt(fixtureExam([1, 2]), ['vocab', 'grammar', 'reading', 'listening'], {
      ...ALL_RIGHT,
      r1: 1,
      l1: 1,
      l2: 2,
    });
    expect(r.total).toBe(120);
    expect(r.status).toBe('fail');
  });

  it('rounds scaled scores', () => {
    // language: v1 right (1) of max 1+1+2=4 → 15
    const r = gradeAttempt(fixtureExam(), ['vocab', 'grammar'], { v1: 1 });
    expect(r.groups.find((g) => g.group === 'language')!.scaled).toBe(15);
  });

  it('ignores unknown ids, unselected parts and out-of-range choices', () => {
    const r = gradeAttempt(fixtureExam(), ['vocab'], { zzz: 1, v1: 9, v2: 2.5, r1: 4 } as never);
    const v = r.parts[0];
    expect(v.answered).toBe(0);
    expect(v.correct).toBe(0);
    expect(r.review.every((x) => x.chosen === null)).toBe(true);
  });
});

describe('toPublicExam / summarizeExam', () => {
  it('strips answers', () => {
    const json = JSON.stringify(toPublicExam(fixtureExam([1, 2])));
    expect(json).not.toContain('"answer"');
    expect(json).toContain('"choiceCount"');
  });

  it('counts questions per part', () => {
    expect(summarizeExam(fixtureExam()).parts).toEqual({
      vocab: { questions: 2 },
      grammar: { questions: 1 },
      reading: { questions: 1 },
      listening: { questions: 2 },
    });
  });
});
