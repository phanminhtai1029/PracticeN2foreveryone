import { useState, type FormEvent } from 'react';
import { api, type User } from '../api';

export function LoginPage({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onLogin((await api.login(username, password)).user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-jp text-5xl font-bold tracking-tight text-accent">N2</p>
          <h1 className="mt-2 text-xl font-semibold">Luyện đề JLPT</h1>
          <p className="mt-1 text-sm text-muted">Đăng nhập để tiếp tục</p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-5">
          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">Tên đăng nhập</span>
            <input
              className="h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-base outline-none focus:border-accent"
              autoComplete="username"
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">Mật khẩu</span>
            <input
              className="h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-base outline-none focus:border-accent"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="text-sm text-bad">{error}</p>}
          <button className="btn-primary h-12 w-full" disabled={busy}>
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-faint">Tài khoản do quản trị viên cấp.</p>
      </div>
    </div>
  );
}
