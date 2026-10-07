export interface Env {
  DB: D1Database;
  AUDIO: R2Bucket;
  /** Login throttle (wrangler.jsonc `ratelimits`). Optional so tests/tools can run without it. */
  LOGIN_LIMIT?: RateLimit;
}

export interface SessionUser {
  id: number;
  username: string;
  role: string;
}

export type AppEnv = { Bindings: Env; Variables: { user: SessionUser } };
