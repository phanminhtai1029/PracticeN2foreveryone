import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import type { Part, PublicExam, PublicMondai } from '../../shared/types';
import { PART_JP, PART_LABEL } from '../../shared/types';
import { api } from '../api';
import { MondaiBlock } from '../components/MondaiBlock';
import { ListeningPlayer } from '../components/ListeningPlayer';
import { QuestionNav } from '../components/QuestionNav';
import { ConfirmDialog, ErrorBox, Icon, Spinner, formatClock } from '../components/ui';
import { clearAttempt, loadAttempt, saveAttempt, type ActiveAttempt } from '../state/attemptStore';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function scrollToQuestion(id: string) {
  document.getElementById(`q-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function TakeExamPage() {
  const { examId = '' } = useParams();
  const [attempt, setAttempt] = useState<ActiveAttempt | null>(() => loadAttempt(examId));
  const [exam, setExam] = useState<PublicExam | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(null);
    api.exam(examId).then(setExam, (e: Error) => setLoadError(e.message));
  }, [examId]);
  useEffect(load, [load]);

  if (!attempt) return <Navigate to={`/exam/${examId}`} replace />;
  if (loadError)
    return (
      <div className="mx-auto max-w-lg p-4 pt-10">
        <ErrorBox message={loadError} onRetry={load} />
      </div>
    );
  if (!exam) return <Spinner full />;
  return <ExamRunner exam={exam} attempt={attempt} setAttempt={setAttempt} />;
}

function ExamRunner({
  exam,
  attempt,
  setAttempt,
}: {
  exam: PublicExam;
  attempt: ActiveAttempt;
  setAttempt: React.Dispatch<React.SetStateAction<ActiveAttempt | null>>;
}) {
  const navigate = useNavigate();
  const now = useNow();
  const [navOpen, setNavOpen] = useState(false);
  const [confirm, setConfirm] = useState<'submit' | 'listening' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const update = useCallback(
    (fn: (a: ActiveAttempt) => ActiveAttempt) =>
      setAttempt((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        saveAttempt(next);
        return next;
      }),
    [setAttempt],
  );

  const selected = useMemo(() => new Set(attempt.parts), [attempt.parts]);
  const hasListening = selected.has('listening') && exam.mondai.some((m) => m.part === 'listening');
  const stageMondai = useMemo(
    () =>
      exam.mondai.filter((m) =>
        selected.has(m.part) && (attempt.stage === 'listening' ? m.part === 'listening' : m.part !== 'listening'),
      ),
    [exam, selected, attempt.stage],
  );
  const stageQuestions = useMemo(() => stageMondai.flatMap((m) => m.questions), [stageMondai]);
  const answeredInStage = stageQuestions.filter((q) => attempt.answers[q.id]).length;
  const allQuestions = useMemo(
    () => exam.mondai.filter((m) => selected.has(m.part)).flatMap((m) => m.questions),
    [exam, selected],
  );
  const unansweredTotal = allQuestions.filter((q) => !attempt.answers[q.id]).length;

  const onChoose = useCallback(
    (id: string, n: number) => update((a) => ({ ...a, answers: { ...a.answers, [id]: n } })),
    [update],
  );

  const goListening = useCallback(() => {
    update((a) => ({ ...a, stage: 'listening' }));
    setConfirm(null);
    window.scrollTo({ top: 0 });
  }, [update]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { id } = await api.submit({
        examId: exam.id,
        parts: attempt.parts,
        answers: attempt.answers,
        startedAt: attempt.startedAt,
      });
      clearAttempt(exam.id);
      navigate(`/result/${id}`, { replace: true });
    } catch (e) {
      setSubmitError((e as Error).message);
      setConfirm('submit');
    } finally {
      setSubmitting(false);
    }
  }, [exam.id, attempt, navigate]);

  // Full test: 言語知識・読解 has a hard 105-minute limit.
  const paperDeadline = attempt.paperStartedAt + exam.timeLimits.languageReading * 1000;
  const countdown = attempt.mode === 'full' && attempt.stage === 'paper';
  const remainingSec = (paperDeadline - now) / 1000;
  const timeUp = countdown && remainingSec <= 0;
  const handledTimeUp = useRef(false);
  useEffect(() => {
    if (!timeUp || handledTimeUp.current) return;
    handledTimeUp.current = true;
    if (hasListening) goListening();
    else void submit();
  }, [timeUp, hasListening, goListening, submit]);

  // Listening: highlight the question currently being played (when timestamps exist).
  const activeId = useMemo(() => {
    if (attempt.stage !== 'listening' || !attempt.listeningStarted) return null;
    let current: string | null = null;
    for (const q of stageQuestions) if (q.startSec !== undefined && q.startSec <= attempt.audioPos) current = q.id;
    return current;
  }, [attempt.stage, attempt.listeningStarted, attempt.audioPos, stageQuestions]);
  const activeLabel = useMemo(() => {
    for (const m of stageMondai) {
      const q = m.questions.find((x) => x.id === activeId);
      if (q) return `問題${m.number} · ${q.label ?? `${q.no}番`}`;
    }
    return null;
  }, [activeId, stageMondai]);
  useEffect(() => {
    if (activeId) scrollToQuestion(activeId);
  }, [activeId]);

  const partsInStage = useMemo(() => {
    const seen: Part[] = [];
    for (const m of stageMondai) if (!seen.includes(m.part)) seen.push(m.part);
    return seen;
  }, [stageMondai]);

  const isLastStage = attempt.stage === 'listening' || !hasListening;
  const clock = countdown ? remainingSec : (now - attempt.startedAt) / 1000;

  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <button
            onClick={() => navigate(`/exam/${exam.id}`)}
            className="-ml-2 grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2"
            aria-label="Thoát (bài làm được lưu)"
            title="Thoát — bài làm được lưu lại"
          >
            <Icon name="back" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{exam.title}</p>
            <p className="font-jp text-xs text-muted">{attempt.stage === 'listening' ? '聴解' : '言語知識・読解'}</p>
          </div>
          <div
            className={`ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums ${countdown && remainingSec < 300 ? 'bg-bad/15 text-bad' : 'bg-surface-2 text-ink'}`}
            title={countdown ? 'Thời gian còn lại' : 'Thời gian đã làm'}
          >
            <Icon name="clock" className="size-4" />
            {formatClock(clock)}
          </div>
          <button
            onClick={() => setNavOpen(true)}
            className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2"
            aria-label="Danh sách câu hỏi"
          >
            <Icon name="grid" />
          </button>
        </div>
        {partsInStage.length > 1 && (
          <nav className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-2">
            {partsInStage.map((p) => (
              <button
                key={p}
                className="chip"
                onClick={() => {
                  const first = stageMondai.find((m) => m.part === p);
                  if (first) document.getElementById(`part-${p}`)?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {PART_LABEL[p]}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4">
        {attempt.stage === 'listening' && exam.audio && (
          <div className="sticky top-[3.6rem] z-20 -mx-4 bg-bg/90 px-4 pt-3 pb-2 backdrop-blur">
            <ListeningPlayer
              src={api.audioUrl(exam.audio.key)}
              durationSec={exam.audio.durationSec}
              startPos={attempt.audioPos}
              started={attempt.listeningStarted}
              nowLabel={activeLabel}
              onStart={() => update((a) => ({ ...a, listeningStarted: true }))}
              onTick={(pos) => update((a) => ({ ...a, audioPos: pos }))}
              onEnded={() => setConfirm('submit')}
            />
          </div>
        )}
        <Stage mondai={stageMondai} answers={attempt.answers} activeId={activeId} onChoose={onChoose} />
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={() => setNavOpen(true)} className="text-left">
            <p className="text-xs text-muted">Đã làm</p>
            <p className="font-semibold tabular-nums">
              {answeredInStage}
              <span className="text-muted">/{stageQuestions.length}</span>
            </p>
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(answeredInStage / Math.max(1, stageQuestions.length)) * 100}%` }} />
          </div>
          <button className="btn-primary" onClick={() => setConfirm(isLastStage ? 'submit' : 'listening')}>
            {isLastStage ? 'Nộp bài' : 'Sang phần Nghe'}
            <Icon name="arrow" className="size-4" />
          </button>
        </div>
      </footer>

      <QuestionNav
        open={navOpen}
        onClose={() => setNavOpen(false)}
        mondai={stageMondai}
        answers={attempt.answers}
        onJump={(id) => {
          setNavOpen(false);
          setTimeout(() => scrollToQuestion(id), 50);
        }}
      />

      <ConfirmDialog
        open={confirm === 'listening'}
        title="Sang phần Nghe hiểu?"
        body={
          <>
            {stageQuestions.length - answeredInStage > 0 && (
              <p>
                Bạn còn <b className="text-warn">{stageQuestions.length - answeredInStage} câu</b> chưa làm ở phần Đọc.
              </p>
            )}
            <p>Sau khi sang phần Nghe sẽ không quay lại phần Đọc được (giống thi thật).</p>
          </>
        }
        confirmLabel="Sang phần Nghe"
        onConfirm={goListening}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'submit'}
        title="Nộp bài?"
        body={
          unansweredTotal > 0 ? (
            <p>
              Bạn còn <b className="text-warn">{unansweredTotal} câu</b> chưa làm. Câu chưa làm tính là sai.
            </p>
          ) : (
            <p>Bạn đã làm hết các câu. Nộp bài để xem kết quả.</p>
          )
        }
        confirmLabel="Nộp bài"
        busy={submitting}
        error={submitError}
        onConfirm={submit}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function Stage({
  mondai,
  answers,
  activeId,
  onChoose,
}: {
  mondai: PublicMondai[];
  answers: ActiveAttempt['answers'];
  activeId: string | null;
  onChoose: (id: string, n: number) => void;
}) {
  return (
    <div className="space-y-4 pt-2">
      {mondai.map((m, i) => {
        const prev = mondai[i - 1];
        const newPart = !prev || prev.part !== m.part;
        return (
          <div key={m.id}>
            {newPart && (
              <h2 id={`part-${m.part}`} className="scroll-mt-28 pt-6 pb-1 text-xl font-bold">
                {PART_LABEL[m.part]} <span className="font-jp text-base font-medium text-muted">{PART_JP[m.part]}</span>
              </h2>
            )}
            <MondaiBlock
              m={m}
              showHeader={!prev || prev.number !== m.number || prev.part !== m.part}
              answers={answers}
              activeId={activeId}
              onChoose={onChoose}
            />
          </div>
        );
      })}
    </div>
  );
}
