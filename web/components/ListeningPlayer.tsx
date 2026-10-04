import { useEffect, useRef, useState } from 'react';
import { Icon, formatClock } from './ui';

type State = 'idle' | 'loading' | 'playing' | 'interrupted' | 'ended' | 'error';

interface Props {
  src: string;
  durationSec: number;
  /** Saved position (seconds) to resume from after a reload. */
  startPos: number;
  started: boolean;
  nowLabel?: string | null;
  onStart: () => void;
  onTick: (pos: number) => void;
  onEnded: () => void;
}

/**
 * Plays the listening audio exactly once, like the real exam: no seek bar,
 * no pause button. If the browser/OS pauses it (phone call, tab killed),
 * the user can only resume from where it stopped.
 */
export function ListeningPlayer({ src, durationSec, startPos, started, nowLabel, onStart, onTick, onEnded }: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  const finishedBefore = started && startPos >= durationSec - 1;
  const [state, setState] = useState<State>(finishedBefore ? 'ended' : 'idle');
  const [pos, setPos] = useState(startPos);
  const [duration, setDuration] = useState(durationSec);
  const lastTick = useRef(0);
  const cb = useRef({ onTick, onEnded });
  cb.current = { onTick, onEnded };

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const on = (ev: string, fn: () => void) => {
      a.addEventListener(ev, fn);
      return () => a.removeEventListener(ev, fn);
    };
    const offs = [
      on('playing', () => setState('playing')),
      on('waiting', () => setState('loading')),
      on('pause', () => setState((s) => (a.ended || s === 'ended' ? 'ended' : 'interrupted'))),
      on('ended', () => {
        setState('ended');
        cb.current.onTick(a.duration || durationSec);
        cb.current.onEnded();
      }),
      on('error', () => setState('error')),
      on('loadedmetadata', () => Number.isFinite(a.duration) && setDuration(a.duration)),
      on('timeupdate', () => {
        setPos(a.currentTime);
        if (Math.abs(a.currentTime - lastTick.current) >= 1) {
          lastTick.current = a.currentTime;
          cb.current.onTick(a.currentTime);
        }
      }),
      // Block media-key / OS seeking: snap back to the furthest point heard.
      on('seeking', () => {
        if (Math.abs(a.currentTime - lastTick.current) > 2) a.currentTime = lastTick.current;
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [durationSec]);

  const play = async () => {
    const a = audio.current;
    if (!a) return;
    setState('loading');
    try {
      if (a.currentTime < 0.5 && pos > 0) {
        lastTick.current = pos;
        a.currentTime = pos;
      }
      if (!started) onStart();
      await a.play();
    } catch {
      setState('error');
    }
  };

  const pct = Math.min(100, (pos / (duration || 1)) * 100);
  const resumeLabel = started && pos > 1 ? `Tiếp tục nghe (${formatClock(pos)})` : 'Bắt đầu nghe';

  return (
    <div className="card overflow-hidden">
      <audio ref={audio} src={src} preload="metadata" />
      <div className="flex items-center gap-3 p-4">
        <span className={`grid size-11 shrink-0 place-items-center rounded-full ${state === 'playing' ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted'}`}>
          <Icon name="headphones" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {state === 'playing' && (nowLabel ? `Đang phát · ${nowLabel}` : 'Đang phát')}
            {state === 'loading' && 'Đang tải audio…'}
            {state === 'idle' && 'Nghe 1 lần'}
            {state === 'interrupted' && 'Audio bị gián đoạn'}
            {state === 'ended' && 'Đã nghe xong'}
            {state === 'error' && 'Không phát được audio'}
          </p>
          <p className="text-sm tabular-nums text-muted">
            {formatClock(pos)} / {formatClock(duration)}
          </p>
        </div>
        {(state === 'idle' || state === 'interrupted' || state === 'error') && (
          <button className="btn-primary shrink-0" onClick={play}>
            <Icon name="play" className="size-4" />
            <span className="hidden sm:inline">{state === 'error' ? 'Thử lại' : resumeLabel}</span>
            <span className="sm:hidden">{state === 'error' ? 'Thử lại' : started && pos > 1 ? 'Tiếp tục' : 'Bắt đầu'}</span>
          </button>
        )}
      </div>
      <div className="h-1 bg-surface-2">
        <div className="h-full bg-accent transition-[width] duration-700 ease-linear" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
