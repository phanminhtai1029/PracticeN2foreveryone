import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth';
import { APP_NAME, Icon } from './ui';

export function Layout({ children, back, wide = false }: { children: ReactNode; back?: string; wide?: boolean }) {
  const { user, logout } = useAuth();
  const width = wide ? 'max-w-3xl lg:max-w-6xl' : 'max-w-3xl';
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur">
        <div className={`mx-auto flex h-14 items-center gap-2 px-4 ${width}`}>
          {back ? (
            <Link to={back} className="-ml-2 grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Quay lại">
              <Icon name="back" />
            </Link>
          ) : null}
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-mincho text-lg font-extrabold text-accent" lang="ja">
              {APP_NAME.jp}
            </span>
            <span className="text-sm font-medium text-muted">{APP_NAME.vi}</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <span className="hidden text-sm text-muted sm:inline">{user.username}</span>
            <button onClick={logout} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Đăng xuất" title="Đăng xuất">
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </header>
      <main className={`mx-auto px-4 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))] ${width}`}>{children}</main>
    </div>
  );
}
