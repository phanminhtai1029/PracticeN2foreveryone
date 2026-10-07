-- Failed login attempts, keyed by "user:<name>" and "ip:<addr>", for the lockout in worker/routes/auth.ts.
CREATE TABLE login_failures (
  key TEXT NOT NULL,
  at INTEGER NOT NULL
);

CREATE INDEX login_failures_key_at ON login_failures(key, at);
