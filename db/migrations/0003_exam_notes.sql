-- Study notes (translation, worked answers, word list), one row per 問題 like exam_mondai.
CREATE TABLE exam_notes (
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  mondai_id TEXT NOT NULL,
  data_json TEXT NOT NULL,
  PRIMARY KEY (exam_id, mondai_id)
);
