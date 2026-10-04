// Usage: npm run user:create -- <username> <password> [--admin] [--remote]
import { hashPassword } from '../worker/auth';
import { wrangler } from './wrangler';

const [username, password] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!username || !password) {
  console.error('Usage: npm run user:create -- <username> <password> [--admin] [--remote]');
  process.exit(1);
}
if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) {
  console.error('Username: 2–32 ký tự a-z, 0-9, _ . -');
  process.exit(1);
}
const role = process.argv.includes('--admin') ? 'admin' : 'user';
const hash = await hashPassword(password);
wrangler([
  'd1',
  'execute',
  'n2db',
  '--command',
  `INSERT INTO users (username, password_hash, role, created_at) VALUES ('${username}', '${hash}', '${role}', ${Date.now()})
   ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, role = excluded.role;`,
]);
console.log(`✓ user ${username} (${role})`);
