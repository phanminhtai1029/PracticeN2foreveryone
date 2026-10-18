import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import type { PublicExam } from '../../shared/types';
import { api } from '../api';
import { Icon, formatClock } from './ui';

/** One listening question's stretch of the exam audio. */
export interface Clip {
  id: string;
  label: string;
  start: number;
  end: number;
}

/** Each question runs from its own mark to the next one, a question or a 問題's instructions, or to the end of the audio. */
export function clipsOf(exam: PublicExam): Map<string, Clip> {
  const clips = new Map<string, Clip>();
  if (!exam.audio) return clips;
  const marks = exam.mondai
    .flatMap((m) => [m.startSec, ...m.questions.map((q) => q.startSec)])
    .filter((s): s is number => s !== undefined)
    .sort((a, b) => a - b);
  for (const m of exam.mondai)
    for (const q of m.questions) {
      const start = q.startSec;
      if (start === undefined) continue;
      const end = marks.find((s) => s > start) ?? exam.audio.durationSec;
      clips.set(q.id, { id: q.id, label: `問題${m.number}　${q.label ?? `${q.no}番`}`, start, end });
    }
  return clips;
}

type Status = 'paused' | 'loading' | 'playing' | 'error';

interface Player {
  clips: Map<string, Clip>;
  clip: Clip | null;
  status: Status;
  rate: number;
  play: (clip: Clip) => void;
  pause: () => void;
  seek: (sec: number) => void;
  setRate: (rate: number) => void;
  close: () => void;
}

const PlayerContext = createContext<Player | null>(null);
/** Seconds into the whole recording. Its own context: it changes four times a second, and only what is playing needs it. */
const PosContext = createContext(0);
export const useReviewAudio = () => useContext(PlayerContext);

/**
 * Unlike the exam, the review lets you replay any question as often as you like:
 * one shared <audio>, played a question at a time and stopped where the next begins.
 */
export function ReviewAudioProvider({ exam, children }: { exam: PublicExam; children: ReactNode }) {
  const clips = useMemo(() => clipsOf(exam), [exam]);
  const audio = useRef<HTMLAudioElement>(null);
  const [clip, setClip] = useState<Clip | null>(null);
  const [status, setStatus] = useState<Status>('paused');
  const [pos, setPos] = useState(0);
  const [rate, setRateState] = useState(1);
  const clipRef = useRef(clip);
  clipRef.current = clip;
  const src = exam.audio && api.audioUrl(exam.audio.key);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const on = (ev: string, fn: () => void) => {
      a.addEventListener(ev, fn);
      return () => a.removeEventListener(ev, fn);
    };
    const offs = [
      on('playing', () => setStatus('playing')),
      on('waiting', () => setStatus('loading')),
      on('pause', () => setStatus((s) => (s === 'error' ? s : 'paused'))),
      on('error', () => setStatus('error')),
      on('timeupdate', () => {
        const c = clipRef.current;
        if (c && !a.paused && a.currentTime >= c.end) {
          a.pause();
          a.currentTime = c.end;
        }
        setPos(a.currentTime);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [src]);

  const player = useMemo<Player>(() => {
    const el = () => audio.current;
    return {
      clips,
      clip,
      status,
      rate,
      play: (c) => {
        const a = el();
        if (!a) return;
        // a new question, or one heard to its end, starts over
        if (clipRef.current?.id !== c.id || a.currentTime < c.start || a.currentTime >= c.end - 0.3) a.currentTime = c.start;
        setClip(c);
        setPos(a.currentTime);
        setStatus('loading');
        a.play().catch((e: Error) => e.name !== 'AbortError' && setStatus('error'));
      },
      pause: () => el()?.pause(),
      seek: (sec) => {
        const a = el();
        const c = clipRef.current;
        if (!a || !c) return;
        a.currentTime = Math.min(c.end, Math.max(c.start, sec));
        setPos(a.currentTime);
      },
      setRate: (r) => {
        const a = el();
        if (a) a.playbackRate = a.defaultPlaybackRate = r;
        setRateState(r);
      },
      close: () => {
        el()?.pause();
        setClip(null);
      },
    };
  }, [clips, clip, status, rate]);

  return (
    <PlayerContext.Provider value={player}>
      <PosContext.Provider value={pos}>
        {src && <audio ref={audio} src={src} preload="none" />}
        {children}
      </PosContext.Provider>
    </PlayerContext.Provider>
  );
}

const isOn = (s: Status) => s === 'playing' || s === 'loading';

/** The play button above a question's script: replays that question's part of the recording. */
export function ListenClip({ id }: { id: string }) {
  const p = useReviewAudio();
  const clip = p?.clips.get(id);
  if (!p || !clip) return null;
  const active = p.clip?.id === id;
  const playing = active && isOn(p.status);
  const len = clip.end - clip.start;
  return (
    <div className={`flex items-center gap-3 rounded-xl border py-2 pr-3.5 pl-2 transition-colors ${active ? 'border-accent/45 bg-accent/[0.06]' : 'border-line'}`}>
      <button
        onClick={() => (playing ? p.pause() : p.play(clip))}
        aria-label={playing ? 'Tạm dừng' : 'Nghe lại câu này'}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition hover:brightness-110 active:scale-95"
      >
        <Icon name={playing ? 'pause' : 'play'} className="size-[18px]" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{active && p.status === 'error' ? 'Không phát được audio' : 'Nghe lại câu này'}</p>
        <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-line">{active && <ClipBar clip={clip} />}</div>
      </div>
      <span className="shrink-0 text-sm text-muted tabular-nums">{active ? <ClipClock clip={clip} /> : formatClock(len)}</span>
    </div>
  );
}

/** How far into the clip, as a fraction and as a clock. */
function useClipAt(clip: Clip) {
  const pos = useContext(PosContext);
  const len = clip.end - clip.start;
  return { at: Math.min(len, Math.max(0, pos - clip.start)), len };
}

// Only the question that is playing mounts these, so the others sit still while the audio runs.
function ClipBar({ clip }: { clip: Clip }) {
  const { at, len } = useClipAt(clip);
  return <div className="h-full bg-accent" style={{ width: `${(at / len) * 100}%` }} />;
}

function ClipClock({ clip }: { clip: Clip }) {
  const { at, len } = useClipAt(clip);
  return `${formatClock(at)} / ${formatClock(len)}`;
}

const RATES = [1, 0.85, 0.7];
const STATUS_TEXT: Record<Status, string> = { playing: 'Đang phát', paused: 'Đã dừng', loading: 'Đang tải…', error: 'Không phát được audio' };

/** Stays at the foot of the column while you scroll down the script, so the controls are always in reach. */
export function ReviewAudioDock() {
  const p = useReviewAudio();
  const pos = useContext(PosContext);
  const clip = p?.clip;
  const len = clip ? clip.end - clip.start : 0;
  const at = clip ? Math.min(len, Math.max(0, pos - clip.start)) : 0;
  const playing = !!p && isOn(p.status);
  return (
    <AnimatePresence>
      {p && clip && (
        <m.div
          key="dock"
          className="sticky bottom-0 z-20 -mx-4 bg-linear-to-t from-bg from-50% to-transparent px-4 pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:mx-0 lg:px-0"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <div className="card px-3 pt-3 pb-2 sm:px-4" role="region" aria-label="Trình phát phần nghe">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => (playing ? p.pause() : p.play(clip))}
                aria-label={playing ? 'Tạm dừng' : 'Phát'}
                className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition hover:brightness-110 active:scale-95"
              >
                <Icon name={playing ? 'pause' : 'play'} />
              </button>
              <div className="min-w-0 flex-1">
                <p lang="ja" className="truncate font-mincho text-[15px] leading-tight font-bold">
                  {clip.label}
                </p>
                <p className={`text-xs ${p.status === 'error' ? 'text-bad' : 'text-muted'}`}>
                  {p.status === 'paused' && at >= len - 0.3 ? 'Hết câu này' : STATUS_TEXT[p.status]}
                </p>
              </div>
              <DockButton label={`Tốc độ ${p.rate}×, bấm để đổi`} onClick={() => p.setRate(RATES[(RATES.indexOf(p.rate) + 1) % RATES.length])}>
                <span className="text-[13px] font-semibold tabular-nums">{p.rate}×</span>
              </DockButton>
              <DockButton label="Đóng trình phát" onClick={p.close}>
                <Icon name="x" className="size-[18px]" />
              </DockButton>
            </div>
            <div className="mt-1 flex items-center gap-1 sm:gap-2">
              <DockButton label="Lùi 5 giây" onClick={() => p.seek(pos - 5)}>
                <Icon name="back5" className="size-[18px]" />
              </DockButton>
              <input
                type="range"
                min={0}
                max={len}
                step={0.1}
                value={at}
                onChange={(e) => p.seek(clip.start + Number(e.target.value))}
                aria-label="Vị trí trong đoạn nghe"
                aria-valuetext={`${formatClock(at)} trên ${formatClock(len)}`}
                className="h-6 min-w-0 flex-1 cursor-pointer accent-accent"
              />
              <DockButton label="Tới 5 giây" onClick={() => p.seek(pos + 5)}>
                <Icon name="ahead5" className="size-[18px]" />
              </DockButton>
              <span className="w-[4.75rem] shrink-0 text-right text-xs text-muted tabular-nums">
                {formatClock(at)} / {formatClock(len)}
              </span>
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function DockButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink">
      {children}
    </button>
  );
}
