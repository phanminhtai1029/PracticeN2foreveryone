import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { ExamSummary, Part } from '../../shared/types';
import { PARTS, PART_JP, PART_LABEL } from '../../shared/types';
import { api } from '../api';
import { Layout } from '../components/Layout';
import { ErrorBox, Icon, Spinner, formatClock } from '../components/ui';
import { clearAttempt, loadAttempt, newAttempt, saveAttempt } from '../state/attemptStore';

export function ExamSetupPage() {
  const { examId = '' } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<ExamSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Part[]>([]);
  const [active, setActive] = useState(() => loadAttempt(examId));
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api.exams().then(
      (list) => {
        const e = list.find((x) => x.id === examId);
        if (e) setExam(e);
        else setError('Không tìm thấy đề này.');
      },
      (err: Error) => setError(err.message),
    );
  }, [examId]);
  useEffect(load, [load]);

  const start = (parts: Part[], mode: 'full' | 'custom') => {
    clearAttempt(examId);
    saveAttempt(newAttempt(examId, parts, mode, Date.now()));
    navigate(`/exam/${examId}/take`);
  };

  if (error)
    return (
      <Layout back="/">
        <ErrorBox message={error} onRetry={load} />
      </Layout>
    );
  if (!exam)
    return (
      <Layout back="/">
        <Spinner />
      </Layout>
    );

  const available = PARTS.filter((p) => exam.parts[p].questions > 0);
  const listeningReady = exam.parts.listening.questions > 0;
  const fullParts = available;
  const pickedCount = picked.reduce((s, p) => s + exam.parts[p].questions, 0);
  const toggle = (p: Part) => setPicked((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : PARTS.filter((x) => x === p || cur.includes(x))));

  return (
    <Layout back="/">
      <h1 className="text-2xl font-bold tracking-tight">{exam.title}</h1>

      {active && (
        <div className="card mt-5 border-warn/40 p-4">
          <p className="font-semibold text-warn">Bạn đang có bài làm dở</p>
          <p className="mt-1 text-sm text-muted">
            {active.mode === 'full' ? 'Full đề' : active.parts.map((p) => PART_LABEL[p]).join(', ')} · đã làm {Object.keys(active.answers).length} câu
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              className="btn-ghost"
              onClick={() => {
                if (!confirmDiscard) return setConfirmDiscard(true);
                clearAttempt(examId);
                setActive(null);
                setConfirmDiscard(false);
              }}
            >
              {confirmDiscard ? 'Chắc chắn bỏ?' : 'Bỏ bài này'}
            </button>
            <Link to={`/exam/${examId}/take`} className="btn-primary">
              Tiếp tục
            </Link>
          </div>
        </div>
      )}

      <button
        onClick={() => start(fullParts, 'full')}
        disabled={!!active}
        className="card mt-5 flex w-full items-center gap-4 border-accent/40 bg-accent/8 p-4 text-left transition hover:border-accent disabled:opacity-40 sm:p-5"
      >
        <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink">
          <Icon name="book" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Làm full đề</p>
          <p className="mt-0.5 text-sm text-muted">
            言語知識・読解 {Math.round(exam.timeLimits.languageReading / 60)} phút
            {listeningReady && exam.audioDurationSec ? ` → 聴解 ${formatClock(exam.audioDurationSec)}` : ''}
          </p>
          {!listeningReady && <p className="mt-1 text-xs text-warn">Phần nghe chưa có — full đề tạm thời không gồm Nghe.</p>}
        </div>
        <Icon name="arrow" className="size-5 text-accent" />
      </button>

      <h2 className="mt-8 mb-3 text-sm font-medium tracking-wide text-muted uppercase">Hoặc chọn phần luyện</h2>
      <div className="grid grid-cols-2 gap-3">
        {PARTS.map((p) => {
          const n = exam.parts[p].questions;
          const on = picked.includes(p);
          return (
            <button
              key={p}
              disabled={n === 0 || !!active}
              onClick={() => toggle(p)}
              aria-pressed={on}
              className={`card relative p-4 text-left transition disabled:opacity-40 ${on ? 'border-accent bg-accent/10' : 'hover:border-line-strong'}`}
            >
              <span className={`absolute top-3 right-3 grid size-6 place-items-center rounded-full border ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong'}`}>
                {on && <Icon name="check" className="size-4" />}
              </span>
              <p className="font-jp text-sm text-muted">{PART_JP[p]}</p>
              <p className="mt-1 font-semibold">{PART_LABEL[p]}</p>
              <p className="mt-2 text-sm text-muted">{n > 0 ? `${n} câu` : 'Sắp có'}</p>
            </button>
          );
        })}
      </div>

      <button className="btn-primary mt-5 h-12 w-full" disabled={picked.length === 0 || !!active} onClick={() => start(picked, 'custom')}>
        {picked.length ? `Bắt đầu · ${pickedCount} câu` : 'Chọn ít nhất một phần'}
      </button>
      <p className="mt-3 text-center text-xs text-faint">Làm theo phần: không giới hạn thời gian, đồng hồ đếm xuôi.</p>
    </Layout>
  );
}
