import { useEffect, type ReactNode } from 'react';
import { ArrowRight, Book, Check, ChevronLeft, Clock, Headphones, History, LayoutGrid, LogOut, Play, X } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';

/** The product name lives here only. 練習帳 = exercise book. */
export const APP_NAME = { jp: '練習帳', vi: 'Luyện tập tiếng Nhật' } as const;

const icons = {
  back: ChevronLeft,
  grid: LayoutGrid,
  clock: Clock,
  logout: LogOut,
  check: Check,
  x: X,
  headphones: Headphones,
  play: Play,
  book: Book,
  arrow: ArrowRight,
  history: History,
} as const;

export function Icon({ name, className = 'size-5' }: { name: keyof typeof icons; className?: string }) {
  const Glyph = icons[name];
  return <Glyph className={className} aria-hidden />;
}

export function Spinner({ full = false }: { full?: boolean }) {
  const s = <div className="size-7 animate-spin rounded-full border-2 border-line border-t-accent" role="status" aria-label="Đang tải" />;
  return full ? <div className="grid min-h-dvh place-items-center">{s}</div> : s;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-start gap-3 border-bad/40 p-4 text-sm">
      <p className="text-bad">{message}</p>
      {onRetry && (
        <button className="btn-ghost" onClick={onRetry}>
          Thử lại
        </button>
      )}
    </div>
  );
}

/** Bottom sheet on phones, centered dialog on wider screens. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  // AnimatePresence keeps the last rendered sheet mounted while it animates out, so callers can clear their state at once.
  return (
    <AnimatePresence>
      {open && (
        <m.div key="sheet" className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal exit={{ opacity: 1 }}>
          <m.div
            className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <m.div
            className="relative max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-lg sm:rounded-3xl"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
            {title && (
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{title}</h2>
                <button className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2" onClick={onClose} aria-label="Đóng">
                  <Icon name="x" />
                </button>
              </div>
            )}
            {children}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title={props.title}>
      <div className="space-y-4 text-[15px] text-muted">{props.body}</div>
      {props.error && <p className="mt-3 text-sm text-bad">{props.error}</p>}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button className="btn-ghost" onClick={props.onClose} disabled={props.busy}>
          Huỷ
        </button>
        <button className="btn-primary" onClick={props.onConfirm} disabled={props.busy}>
          {props.busy ? 'Đang gửi…' : props.confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

export function formatClock(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function formatDate(ms: number) {
  return new Date(ms).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
