import { execFileSync } from 'node:child_process';

export const REMOTE = process.argv.includes('--remote');

export function wrangler(args: string[]) {
  execFileSync('npx', ['wrangler', ...args, REMOTE ? '--remote' : '--local'], { stdio: 'inherit' });
}
