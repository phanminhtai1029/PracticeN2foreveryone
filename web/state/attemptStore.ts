import type { Answers, Part } from '../../shared/types';

export type Stage = 'paper' | 'listening';

export interface ActiveAttempt {
  examId: string;
  parts: Part[];
  mode: 'full' | 'custom';
  answers: Answers;
  startedAt: number;
  stage: Stage;
  paperStartedAt: number;
  listeningStarted: boolean;
  audioPos: number;
}

const key = (examId: string) => `n2:attempt:${examId}`;
const store = (s?: Storage): Storage | null => s ?? (typeof localStorage === 'undefined' ? null : localStorage);

export function newAttempt(examId: string, parts: Part[], mode: ActiveAttempt['mode'], now: number): ActiveAttempt {
  const paper = parts.some((p) => p !== 'listening');
  return {
    examId,
    parts,
    mode,
    answers: {},
    startedAt: now,
    stage: paper ? 'paper' : 'listening',
    paperStartedAt: now,
    listeningStarted: false,
    audioPos: 0,
  };
}

export function loadAttempt(examId: string, s?: Storage): ActiveAttempt | null {
  try {
    const raw = store(s)?.getItem(key(examId));
    if (!raw) return null;
    const a = JSON.parse(raw) as ActiveAttempt;
    if (a.examId !== examId || !Array.isArray(a.parts) || typeof a.answers !== 'object' || !a.stage) return null;
    return a;
  } catch {
    return null;
  }
}

export function saveAttempt(a: ActiveAttempt, s?: Storage): void {
  try {
    store(s)?.setItem(key(a.examId), JSON.stringify(a));
  } catch {
    // Storage full or disabled — the attempt still lives in memory.
  }
}

export function clearAttempt(examId: string, s?: Storage): void {
  store(s)?.removeItem(key(examId));
}
