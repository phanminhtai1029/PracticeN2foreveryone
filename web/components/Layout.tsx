import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth';
import { Icon } from './ui';

export function Layout({ children, back }: { children: ReactNode; back?: string }) {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          {back ? (
            <Link to={back} className="-ml-2 grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Quay lại">
              <Icon name="back" />
            </Link>
          ) : null}
          <Link to="/" className="flex items-baseline gap-2 font-semibold tracking-tight">
            <span className="font-jp text-lg text-accent">N2</span>
            <span>Luyện đề</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <span className="hidden text-sm text-muted sm:inline">{user.username}</span>
            <button onClick={logout} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Đăng xuất" title="Đăng xuất">
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))]">{children}</main>
    </div>
  );
}
