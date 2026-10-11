export type Part = 'vocab' | 'grammar' | 'reading' | 'listening';
export type Group = 'language' | 'reading' | 'listening';

export const PARTS: Part[] = ['vocab', 'grammar', 'reading', 'listening'];
export const GROUPS: Group[] = ['language', 'reading', 'listening'];
export const isFullExam = (parts: readonly Part[]) => PARTS.every((p) => parts.includes(p));

export const PART_GROUP: Record<Part, Group> = {
  vocab: 'language',
  grammar: 'language',
  reading: 'reading',
  listening: 'listening',
};

export interface Question {
  id: string;
  no: number;
  label?: string;
  stem: string;
  /** figure printed with the question (e.g. listening 問題1 maps) */
  image?: string;
  choices: string[];
  choiceCount: number;
  answer: number | null;
  answerVerified?: boolean;
  answerNote?: string;
  /** listening: offset in the audio where this question starts */
  startSec?: number;
}

export interface Mondai {
  id: string;
  part: Part;
  number: number;
  title?: string;
  instruction: string;
  weight: number;
  passage?: string;
  image?: string;
  startSec?: number;
  questions: Question[];
}

export interface Exam {
  id: string;
  title: string;
  level: string;
  sortOrder?: number;
  audio?: { key: string; durationSec: number };
  timeLimits: { languageReading: number };
  mondai: Mondai[];
}

export type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export const LEVELS: Level[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

export interface VocabNote {
  /** dictionary form */
  word: string;
  /** kana reading; left out for kana-only words */
  reading?: string;
  /** Sino-Vietnamese reading of the kanji */
  hanViet?: string;
  pos: string;
  meaning: string;
  level: Level;
  /** `no` of the questions whose own text uses it; absent when it only occurs in the passage */
  q?: number[];
}

export interface GrammarNote {
  pattern: string;
  /** how it attaches, e.g. "N + に至っては" */
  form: string;
  meaning: string;
  level: Level;
  note?: string;
  /** a sentence from the exam that uses it */
  example: string;
  exampleVi: string;
  q?: number[];
}

export interface QuestionNote {
  id: string;
  /** the sentence with the right answer filled in */
  filled?: string;
  stemVi: string;
  /** one per choice, in order: its translation and why it is right or wrong */
  choices: { vi: string; why?: string }[];
  explain: string;
  /** the passage sentence the answer rests on */
  evidence?: string;
}

/** Translation, worked answers and word list for one 問題. Authored in content/exams/<id>/notes/*.json. */
export interface MondaiNotes {
  mondaiId: string;
  instructionVi: string;
  /** line for line with the passage */
  passageVi?: string;
  questions: QuestionNote[];
  vocab: VocabNote[];
  grammar: GrammarNote[];
}

/** What can be read before sitting the exam: the word list, without the worked answers. */
export type StudyNotes = Pick<MondaiNotes, 'mondaiId' | 'vocab' | 'grammar'>;

export type PublicQuestion = Omit<Question, 'answer' | 'answerVerified' | 'answerNote'>;
export type PublicMondai = Omit<Mondai, 'questions'> & { questions: PublicQuestion[] };
export type PublicExam = Omit<Exam, 'mondai'> & { mondai: PublicMondai[] };

/** questionId -> chosen option (1-based) */
export type Answers = Record<string, number>;

export interface PartResult {
  part: Part;
  correct: number;
  total: number;
  answered: number;
  ungraded: number;
  weighted: number;
  maxWeighted: number;
}

export interface GroupResult {
  group: Group;
  scaled: number | null;
  reason?: string;
}

export interface QuestionReview {
  id: string;
  part: Part;
  chosen: number | null;
  answer: number | null;
  correct: boolean | null;
}

export interface AttemptResult {
  parts: PartResult[];
  groups: GroupResult[];
  total: number | null;
  status: 'pass' | 'fail' | 'provisional';
  review: QuestionReview[];
}

export interface ExamSummary {
  id: string;
  title: string;
  level: string;
  hasAudio: boolean;
  timeLimits: Exam['timeLimits'];
  audioDurationSec: number | null;
  parts: Record<Part, { questions: number }>;
}

export interface AttemptListItem {
  id: number;
  examId: string;
  parts: Part[];
  total: number | null;
  status: AttemptResult['status'];
  /** raw counts over graded questions — the headline for part-practice attempts */
  correct: number;
  graded: number;
  submittedAt: number;
}

export interface AttemptDetail {
  id: number;
  examId: string;
  parts: Part[];
  answers: Answers;
  result: AttemptResult;
  startedAt: number;
  submittedAt: number;
}

export const PART_LABEL: Record<Part, string> = {
  vocab: 'Từ vựng',
  grammar: 'Ngữ pháp',
  reading: 'Đọc hiểu',
  listening: 'Nghe hiểu',
};

export const PART_JP: Record<Part, string> = {
  vocab: '文字・語彙',
  grammar: '文法',
  reading: '読解',
  listening: '聴解',
};

export const GROUP_LABEL: Record<Group, string> = {
  language: '言語知識',
  reading: '読解',
  listening: '聴解',
};
