import type { Exam } from '../shared/types';

const q = (id: string, no: number, answer: number | null, choiceCount = 4) => ({
  id,
  no,
  stem: `stem ${id}`,
  choices: answer === null ? [] : Array.from({ length: choiceCount }, (_, k) => `c${k + 1}`),
  choiceCount,
  answer,
});

/** vocab: v1,v2 (w1) · grammar: g1 (w2) · reading: r1 (w3) · listening: l1,l2 (w2, no answers) */
export function fixtureExam(listeningAnswers: (number | null)[] = [null, null]): Exam {
  return {
    id: 'fx',
    title: 'Fixture',
    level: 'N2',
    audio: { key: 'fx/listening.mp3', durationSec: 60 },
    timeLimits: { languageReading: 6300 },
    mondai: [
      { id: 'mv', part: 'vocab', number: 1, instruction: 'i', weight: 1, questions: [q('v1', 1, 1), q('v2', 2, 2)] },
      { id: 'mg', part: 'grammar', number: 7, instruction: 'i', weight: 2, questions: [q('g1', 3, 3)] },
      { id: 'mr', part: 'reading', number: 10, instruction: 'i', weight: 3, passage: 'p', questions: [q('r1', 4, 4)] },
      {
        id: 'ml',
        part: 'listening',
        number: 1,
        instruction: 'i',
        weight: 2,
        questions: [q('l1', 1, listeningAnswers[0], 3), q('l2', 2, listeningAnswers[1], 3)],
      },
    ],
  };
}

export const ALL_RIGHT = { v1: 1, v2: 2, g1: 3, r1: 4 };
