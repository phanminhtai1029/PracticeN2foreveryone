export interface Env {
  DB: D1Database;
  AUDIO: R2Bucket;
}

export interface SessionUser {
  id: number;
  username: string;
  role: string;
}

export type AppEnv = { Bindings: Env; Variables: { user: SessionUser } };
