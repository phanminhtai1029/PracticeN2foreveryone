CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE exams (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  level TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  meta_json TEXT NOT NULL
);

-- One row per 問題 to stay under D1's 100KB statement limit.
CREATE TABLE exam_mondai (
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  ord INTEGER NOT NULL,
  data_json TEXT NOT NULL,
  PRIMARY KEY (exam_id, ord)
);

CREATE TABLE attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id TEXT NOT NULL,
  parts_json TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  submitted_at INTEGER NOT NULL
);

CREATE INDEX attempts_user_exam ON attempts(user_id, exam_id, submitted_at DESC);
