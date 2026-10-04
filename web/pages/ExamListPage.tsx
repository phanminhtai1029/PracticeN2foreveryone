import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { AttemptListItem, ExamSummary } from '../../shared/types';
import { PARTS, PART_LABEL } from '../../shared/types';
import { api } from '../api';
import { Layout } from '../components/Layout';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorBox, Icon, Spinner, formatDate } from '../components/ui';
import { loadAttempt } from '../state/attemptStore';

export function ExamListPage() {
  const [exams, setExams] = useState<ExamSummary[] | null>(null);
  const [history, setHistory] = useState<AttemptListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([api.exams(), api.attempts()]).then(
      ([e, h]) => {
        setExams(e);
        setHistory(h);
      },
      (err: Error) => setError(err.message),
    );
  }, []);
  useEffect(load, [load]);

  return (
    <Layout>
      <h1 className="text-2xl font-bold tracking-tight">Đề thi</h1>
      <p className="mt-1 text-sm text-muted">Chọn một đề để luyện theo phần hoặc làm full.</p>

      <div className="mt-5 space-y-3">
        {error && <ErrorBox message={error} onRetry={load} />}
        {!exams && !error && <Spinner />}
        {exams?.map((e) => {
          const active = loadAttempt(e.id);
          const total = PARTS.reduce((s, p) => s + e.parts[p].questions, 0);
          return (
            <Link key={e.id} to={`/exam/${e.id}`} className="card group block p-4 transition hover:border-line-strong sm:p-5">
              <div className="flex items-start gap-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent/12 font-jp text-lg font-bold text-accent">{e.level}</div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{e.title}</h2>
                  <p className="mt-0.5 text-sm text-muted">
                    {total} câu{e.hasAudio && e.parts.listening.questions === 0 ? ' · phần nghe đang cập nhật' : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {PARTS.filter((p) => e.parts[p].questions > 0).map((p) => (
                      <span key={p} className="chip min-h-7 text-xs">
                        {PART_LABEL[p]} · {e.parts[p].questions}
                      </span>
                    ))}
                  </div>
                  {active && <p className="mt-3 text-sm font-medium text-warn">Có bài đang làm dở — bấm để tiếp tục</p>}
                </div>
                <Icon name="arrow" className="mt-1 size-5 text-faint transition group-hover:translate-x-0.5 group-hover:text-accent" />
              </div>
            </Link>
          );
        })}
      </div>

      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Icon name="history" className="size-5 text-muted" /> Lịch sử làm bài
          </h2>
          <ul className="card mt-3 divide-y divide-line">
            {history.slice(0, 10).map((h) => (
              <li key={h.id}>
                <Link to={`/result/${h.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {exams?.find((e) => e.id === h.examId)?.title ?? h.examId}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {formatDate(h.submittedAt)} · {h.parts.length === 4 ? 'Full đề' : h.parts.map((p) => PART_LABEL[p]).join(', ')}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">{h.total ?? '—'}</span>
                  <StatusBadge status={h.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Layout>
  );
}
