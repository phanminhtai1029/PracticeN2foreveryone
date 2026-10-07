import { Hono, type Context } from 'hono';
import type { AppEnv } from '../env';

/** Streams an object from the AUDIO bucket, honouring Range requests (seeking in <audio>). */
export async function serveR2(c: Context<AppEnv>, key: string, fallbackType: string) {
  const range = c.req.header('range');
  const obj = await c.env.AUDIO.get(key, range ? { range: c.req.raw.headers } : undefined);
  if (!obj) return c.json({ error: 'not found' }, 404);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', 'private, max-age=86400');
  if (!headers.has('content-type')) headers.set('content-type', fallbackType);

  const r = obj.range as { offset?: number; length?: number; suffix?: number } | undefined;
  if (range && r) {
    const offset = r.suffix !== undefined ? obj.size - r.suffix : (r.offset ?? 0);
    const length = r.suffix !== undefined ? r.suffix : (r.length ?? obj.size - offset);
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${obj.size}`);
    headers.set('content-length', String(length));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set('content-length', String(obj.size));
  return new Response(obj.body, { headers });
}

export const audioRoutes = new Hono<AppEnv>().get('/*', (c) =>
  serveR2(c, decodeURIComponent(c.req.path.replace(/^\/api\/audio\//, '')), 'audio/mpeg'),
);
