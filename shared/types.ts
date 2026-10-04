export type Part = 'vocab' | 'grammar' | 'reading' | 'listening';
export type Group = 'language' | 'reading' | 'listening';

export const PARTS: Part[] = ['vocab', 'grammar', 'reading', 'listening'];
export const GROUPS: Group[] = ['language', 'reading', 'listening'];
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
  choices: string[];
  choiceCount: number;
  answer: number | null;
  answerVerified?: boolean;
  answerNote?: string;
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
