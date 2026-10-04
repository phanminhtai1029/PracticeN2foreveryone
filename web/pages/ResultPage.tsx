import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { AttemptDetail, GroupResult, Part, PublicExam, PublicMondai, PublicQuestion, QuestionReview } from '../../shared/types';
import { GROUP_LABEL, PART_JP, PART_LABEL } from '../../shared/types';
import { PASS_GROUP_MIN, PASS_TOTAL } from '../../shared/scoring';
import { api } from '../api';
import { Layout } from '../components/Layout';
import { Markup } from '../components/Markup';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorBox, Sheet, Spinner, formatClock, formatDate } from '../components/ui';

export function ResultPage() {
  const { attemptId = '' } = useParams();
  const [data, setData] = useState<{ attempt: AttemptDetail; exam: PublicExam } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .attempt(attemptId)
      .then(async (attempt) => setData({ attempt, exam: await api.exam(attempt.examId) }))
      .catch((e: Error) => setError(e.message));
  }, [attemptId]);
  useEffect(load, [load]);

  return (
    <Layout back="/">
      {error && <ErrorBox message={error} onRetry={load} />}
      {!data && !error && <Spinner />}
      {data && <ResultView attempt={data.attempt} exam={data.exam} />}
    </Layout>
  );
}

function Ring({ value, max = 60, size = 76 }: { value: number | null; max?: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = value === null ? 0 : value / max;
  const color = value === null ? 'var(--color-line-strong)' : value >= PASS_GROUP_MIN ? 'var(--color-accent)' : 'var(--color-bad)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={7} />
      {pct > 0 && <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
      />}
    </svg>
  );
}

function GroupCard({ g }: { g: GroupResult }) {
  return (
    <div className="card flex flex-col items-center p-3 text-center sm:p-4">
      <div className="relative">
        <Ring value={g.scaled} />
        <span className="absolute inset-0 grid place-items-center text-lg font-bold tabular-nums">{g.scaled ?? '—'}</span>
      </div>
      <p className="mt-2 font-jp text-sm font-semibold">{GROUP_LABEL[g.group]}</p>
      <p className="mt-0.5 text-xs text-muted">{g.scaled === null ? g.reason : '/ 60'}</p>
    </div>
  );
}

function ResultView({ attempt, exam }: { attempt: AttemptDetail; exam: PublicExam }) {
  const { result } = attempt;
  const [open, setOpen] = useState<string | null>(null);

  const questionIndex = useMemo(() => {
    const idx = new Map<string, { q: PublicQuestion; m: PublicMondai }>();
    for (const m of exam.mondai) for (const q of m.questions) idx.set(q.id, { q, m });
    return idx;
  }, [exam]);
  const reviewByPart = useMemo(() => {
    const map = new Map<Part, QuestionReview[]>();
    for (const r of result.review) map.set(r.part, [...(map.get(r.part) ?? []), r]);
    return map;
  }, [result.review]);
  const openReview = open ? result.review.find((r) => r.id === open) : undefined;
  const duration = (attempt.submittedAt - attempt.startedAt) / 1000;

  return (
    <div className="space-y-6">
      <section className="card relative overflow-hidden p-5 text-center sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-72 rounded-full bg-accent/10 blur-3xl" />
        <p className="text-sm text-muted">{exam.title}</p>
        <div className="mt-3 flex items-baseline justify-center gap-1">
          <span className="text-6xl font-bold tracking-tight tabular-nums">{result.total ?? '—'}</span>
          <span className="text-xl text-muted">/180</span>
        </div>
        <StatusBadge status={result.status} className="mt-3 px-3 py-1 text-sm" />
        <p className="mt-3 text-xs text-faint">
          {result.status === 'provisional'
            ? 'Chưa đủ dữ liệu để kết luận đỗ/trượt (cần làm full đề và có đủ đáp án).'
            : `Điểm đỗ N2: tổng ≥ ${PASS_TOTAL} và mỗi phần ≥ ${PASS_GROUP_MIN}. Điểm quy đổi chỉ mang tính ước lượng.`}
        </p>
        <p className="mt-1 text-xs text-faint">
          {formatDate(attempt.submittedAt)} · làm trong {formatClock(duration)}
        </p>
      </section>

      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        {result.groups.map((g) => (
          <GroupCard key={g.group} g={g} />
        ))}
      </section>

      <section className="card divide-y divide-line">
        {result.parts.map((p) => {
          const pct = p.total ? Math.round((p.correct / p.total) * 100) : null;
          return (
            <div key={p.part} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{PART_LABEL[p.part]}</p>
                <p className="font-jp text-xs text-faint">{PART_JP[p.part]}</p>
              </div>
              {p.ungraded > 0 && p.total === 0 ? (
                <span className="text-sm text-warn">Chưa có đáp án · đã làm {p.answered}</span>
              ) : (
                <>
                  <div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-surface-2 sm:block">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${pct ?? 0}%` }} />
                  </div>
                  <span className="w-20 text-right font-semibold tabular-nums">
                    {p.correct}
                    <span className="text-muted">/{p.total}</span>
                  </span>
                  <span className="w-11 text-right text-sm text-muted tabular-nums">{pct}%</span>
                </>
              )}
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Xem lại từng câu</h2>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
          <Legend cls="bg-good/20 text-good border-good/40" label="Đúng" />
          <Legend cls="bg-bad/15 text-bad border-bad/40" label="Sai" />
          <Legend cls="border-dashed border-bad/50 text-bad" label="Bỏ trống" />
          <Legend cls="border-line-strong text-muted" label="Chưa có đáp án" />
        </div>
        <div className="mt-4 space-y-5">
          {[...reviewByPart].map(([part, items]) => (
            <div key={part}>
              <p className="mb-2 text-sm font-medium text-muted">{PART_LABEL[part]}</p>
              <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-12">
                {items.map((r) => {
                  const q = questionIndex.get(r.id)?.q;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setOpen(r.id)}
                      className={`h-10 rounded-lg border text-sm font-semibold tabular-nums ${reviewClass(r)}`}
                    >
                      {q?.no ?? '?'}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/" className="btn-ghost">
          Về danh sách
        </Link>
        <Link to={`/exam/${exam.id}`} className="btn-primary">
          Làm lại
        </Link>
      </div>

      <Sheet
        open={!!openReview}
        onClose={() => setOpen(null)}
        title={openReview ? `Câu ${questionIndex.get(openReview.id)?.q.label ?? questionIndex.get(openReview.id)?.q.no}` : ''}
      >
        {openReview && questionIndex.get(openReview.id) && (
          <ReviewDetail review={openReview} {...questionIndex.get(openReview.id)!} />
        )}
      </Sheet>
    </div>
  );
}

function reviewClass(r: QuestionReview) {
  if (r.correct === null) return 'border-line-strong text-muted';
  if (r.correct) return 'border-good/40 bg-good/20 text-good';
  if (r.chosen === null) return 'border-dashed border-bad/50 text-bad';
  return 'border-bad/40 bg-bad/15 text-bad';
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <i className={`size-3.5 rounded border ${cls}`} />
      {label}
    </span>
  );
}

function ReviewDetail({ review, q, m }: { review: QuestionReview; q: PublicQuestion; m: PublicMondai }) {
  const [showPassage, setShowPassage] = useState(false);
  const choices = q.choices.length ? q.choices : Array.from({ length: q.choiceCount }, () => '');
  return (
    <div className="space-y-4">
      <p className="font-jp text-xs text-faint">
        問題{m.number}
        {m.title ? ` ${m.title}` : ''}
      </p>
      {(m.passage || m.image) && (
        <div>
          <button className="text-sm font-medium text-accent" onClick={() => setShowPassage((v) => !v)}>
            {showPassage ? 'Ẩn đoạn văn' : 'Xem đoạn văn'}
          </button>
          {showPassage &&
            (m.passage ? (
              <Markup text={m.passage} className="jp mt-2 block rounded-xl bg-surface-2/60 p-3" />
            ) : (
              <img src={m.image} alt="" className="mt-2 w-full rounded-lg bg-white" />
            ))}
        </div>
      )}
      {q.stem && <Markup text={q.stem} className="jp block" />}
      {q.image && <img src={q.image} alt="" className="w-full rounded-xl bg-white" />}
      <div className="grid gap-2">
        {choices.map((c, i) => {
          const n = i + 1;
          const isAnswer = review.answer === n;
          const isChosen = review.chosen === n;
          const ungraded = review.answer === null;
          const cls = isAnswer ? 'border-good/60 bg-good/12' : isChosen ? (ungraded ? 'border-accent/60 bg-accent/10' : 'border-bad/60 bg-bad/10') : 'border-line';
          return (
            <div key={n} className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 ${cls}`}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line-strong text-sm font-semibold">{n}</span>
              {c ? <Markup text={c} className="jp min-w-0 flex-1 leading-[1.9]" /> : <span className="flex-1" />}
              {isAnswer && <span className="text-xs font-semibold text-good">Đáp án</span>}
              {isChosen && !isAnswer && <span className={`text-xs font-semibold ${ungraded ? 'text-accent' : 'text-bad'}`}>Bạn chọn</span>}
            </div>
          );
        })}
      </div>
      {review.chosen === null && <p className="text-sm text-bad">Bạn chưa chọn câu này.</p>}
      {review.answer === null && <p className="text-sm text-warn">Câu này chưa có đáp án.</p>}
      <p className="rounded-xl border border-dashed border-line p-3 text-sm text-faint">Giải thích sẽ được bổ sung sau.</p>
    </div>
  );
}
