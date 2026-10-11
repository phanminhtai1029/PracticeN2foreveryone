import { useState, type FormEvent } from 'react';
import { api, type User } from '../api';
import { APP_NAME } from '../components/ui';

const FIELD = 'h-11 w-full rounded-none border-0 border-b-2 border-ink/70 bg-transparent px-0.5 text-base focus:border-accent';

/** The cover of an exercise book: spine tape, the title set vertically, and a name plate that is the sign-in form. */
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
    <div className="grid min-h-dvh place-items-center p-4 sm:p-8">
      <main className="card relative flex min-h-[min(40rem,calc(100dvh-2rem))] w-full max-w-md flex-col overflow-hidden pl-5 sm:pl-6">
        <div className="absolute inset-y-0 left-0 w-5 bg-accent sm:w-6" aria-hidden />

        <div className="flex flex-1 justify-between gap-4 px-6 pt-8 pb-6 sm:px-8 sm:pt-10">
          <div className="self-end">
            <p className="text-xl font-semibold">{APP_NAME.vi}</p>
            <p className="mt-1.5 max-w-[20ch] text-sm text-muted">Đề JLPT, làm cả đề hoặc luyện từng phần.</p>
          </div>
          <h1 className="font-mincho text-6xl leading-none font-extrabold tracking-[0.14em] text-accent [writing-mode:vertical-rl] sm:text-7xl" lang="ja">
            {APP_NAME.jp}
          </h1>
        </div>

        <form onSubmit={submit} className="mx-6 mb-4 space-y-5 rounded-md border-2 border-ink p-5 sm:mx-8">
          <label className="block">
            <span className="block text-sm text-muted">
              <span className="font-jp font-medium text-ink" lang="ja">
                名前
              </span>{' '}
              Tên đăng nhập
            </span>
            <input className={FIELD} autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label className="block">
            <span className="block text-sm text-muted">
              <span className="font-jp font-medium text-ink" lang="ja">
                合言葉
              </span>{' '}
              Mật khẩu
            </span>
            <input className={FIELD} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="text-sm text-bad">{error}</p>}
          <button className="btn-primary h-12 w-full" disabled={busy}>
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>
        <p className="px-6 pb-5 text-xs text-faint sm:px-8">Tài khoản do quản trị viên cấp.</p>
      </main>
    </div>
  );
}
