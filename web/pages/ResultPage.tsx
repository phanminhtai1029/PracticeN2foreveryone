import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { animate, m, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import type { AttemptDetail, AttemptResult, Group, MondaiNotes, Part, PartResult, PublicExam, PublicMondai, PublicQuestion, QuestionReview } from '../../shared/types';
import { GROUP_LABEL, PART_JP, PART_LABEL, isFullExam } from '../../shared/types';
import { TOTAL_MAX, passTotal, sectionsOf, type Section } from '../../shared/scoring';
import { api } from '../api';
import { ExplainTab, MARK_LABEL, PassagePair, QuestionExplained, markOf, type Mark } from '../components/Explain';
import { Layout } from '../components/Layout';
import { ReviewAudioDock, ReviewAudioProvider } from '../components/ReviewAudio';
import { StudyList } from '../components/StudyList';
import { ErrorBox, Sheet, formatClock, formatDate } from '../components/ui';

const GROUP_VI: Record<Group, string> = { language: 'Kiến thức ngôn ngữ', languageReading: 'Ngôn ngữ và đọc hiểu', reading: 'Đọc hiểu', listening: 'Nghe hiểu' };

/** The slip draws its bars and counts the score first; the verdict stamp lands once they settle. */
const DRAW = 0.7;
const EASE = [0.2, 0.7, 0.2, 1] as const;
const STAMP_LAND = { delay: DRAW + 0.15, duration: 0.2, ease: 'easeIn' } as const;

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
    <Layout back="/" wide>
      {error && <ErrorBox message={error} onRetry={load} />}
      {!data && !error && <div className="h-[28rem] max-w-[30rem] animate-pulse rounded-md bg-line" role="status" aria-label="Đang tải kết quả" />}
      {data && <ResultView attempt={data.attempt} exam={data.exam} />}
    </Layout>
  );
}

function CountUp({ to }: { to: number }) {
  const reduce = useReducedMotion();
  const value = useMotionValue(reduce ? to : 0);
  const text = useTransform(value, (n) => String(Math.round(n)));
  useEffect(() => {
    if (reduce) return;
    const controls = animate(value, to, { duration: DRAW, ease: EASE });
    return () => controls.stop();
  }, [to, reduce, value]);
  // the hidden final number holds the width so the line does not shift while digits change
  return (
    <span className="relative inline-block">
      <span className="sr-only">{to}</span>
      <span className="invisible" aria-hidden>
        {to}
      </span>
      <m.span className="absolute inset-0 text-right" aria-hidden>
        {text}
      </m.span>
    </span>
  );
}

/** Ruler-style bar. The tick is the pass mark, so the rule is on the slip and not only the score. */
function Gauge({ value, max, mark, order = 0 }: { value: number | null; max: number; mark?: number; order?: number }) {
  const below = mark !== undefined && value !== null && value < mark;
  return (
    <div className={`relative h-2 bg-line ${mark === undefined ? '' : 'mb-5'}`}>
      {!!value && (
        <m.div
          className={`h-full origin-left ${below ? 'bg-shu' : 'bg-ink'}`}
          style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: DRAW, delay: order * 0.06, ease: EASE }}
        />
      )}
      {mark !== undefined && (
        <span className="absolute -top-1 flex -translate-x-1/2 flex-col items-center" style={{ left: `${(mark / max) * 100}%` }}>
          <i className="h-4 w-0.5 bg-ink ring-1 ring-surface" />
          <span className="mt-0.5 text-[11px] leading-none text-muted tabular-nums">{mark}</span>
        </span>
      )}
    </div>
  );
}

const STAMP = {
  pass: { text: '合格', label: 'Đỗ', cls: 'size-[5.5rem] rounded-full text-[1.75rem] text-shu outline outline-1 -outline-offset-[7px] outline-current' },
  fail: { text: '不合格', label: 'Chưa đỗ', cls: 'rounded-lg px-2.5 py-3 text-2xl text-shu' },
  provisional: { text: '仮採点', label: 'Tạm tính', cls: 'rounded-lg border-dashed px-2.5 py-3 text-2xl text-accent' },
  practice: { text: '練習', label: 'Luyện tập', cls: 'rounded-lg px-2.5 py-3 text-2xl text-accent' },
} as const;

function Stamp({ kind }: { kind: keyof typeof STAMP }) {
  const s = STAMP[kind];
  return (
    <m.div
      className="pointer-events-none absolute top-5 right-5 mix-blend-multiply sm:top-6 sm:right-7"
      initial={{ opacity: 0, scale: 1.7, rotate: -16 }}
      animate={{ opacity: 1, scale: [1.7, 0.96, 1], rotate: -8 }}
      // `times` belongs to scale alone: opacity and rotate have two keyframes, and three times make them dip before landing
      transition={{ ...STAMP_LAND, scale: { ...STAMP_LAND, times: [0, 0.8, 1] } }}
    >
      <span className="sr-only">Kết quả: {s.label}</span>
      <span
        aria-hidden
        className={`grid place-items-center border-[3px] border-current font-mincho leading-none font-extrabold tracking-[0.06em] [filter:url(#stamp-ink)] [writing-mode:vertical-rl] ${s.cls}`}
      >
        {s.text}
      </span>
      {/* uneven ink: roughen the edges, then let a coarser noise thin the colour in patches */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <filter id="stamp-ink" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="4" result="grain" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.8" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="11" result="blot" />
          <feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.4 0 0 0 2.75" result="mask" />
          <feComposite in="rough" in2="mask" operator="in" />
        </filter>
      </svg>
    </m.div>
  );
}

function PartLine({ p, named }: { p: PartResult; named: boolean }) {
  const ungraded = p.total === 0;
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      {named ? (
        <dt>
          <span className="font-jp">{PART_JP[p.part]}</span> <span className="text-muted">{PART_LABEL[p.part]}</span>
        </dt>
      ) : (
        <dt className="text-muted">{ungraded ? 'Chưa có đáp án' : 'Số câu đúng'}</dt>
      )}
      <dd className="text-muted tabular-nums">
        {ungraded ? (
          `${named ? 'chưa có đáp án, ' : ''}đã làm ${p.answered} câu`
        ) : (
          <>
            <span className="font-semibold text-ink">{p.correct}</span>/{p.total} câu, {Math.round((p.correct / p.total) * 100)}%
          </>
        )}
      </dd>
    </div>
  );
}

/** An unfilled field on the slip, for scores that cannot be worked out yet. */
const BLANK = (
  <>
    <span className="sr-only">chưa tính được</span>
    <i className="inline-block w-[1.5em] border-b-2 border-muted/50" aria-hidden />
  </>
);

function Row(props: { jp: string; vi: string; score: number | null; max: number; mark?: number; order: number; note?: string; children?: ReactNode }) {
  const below = props.mark !== undefined && props.score !== null && props.score < props.mark;
  return (
    <li className="py-4">
      <div className="flex items-end justify-between gap-3">
        <p>
          <span className="block font-mincho text-lg leading-tight font-bold">{props.jp}</span>
          <span className="text-sm text-muted">{props.vi}</span>
        </p>
        <p className="font-mincho tabular-nums">
          <span className={`text-3xl leading-none font-bold ${below ? 'text-bad' : ''}`}>{props.score ?? BLANK}</span>
          <span className="text-muted">/{props.max}</span>
        </p>
      </div>
      <div className="mt-2.5">
        <Gauge value={props.score} max={props.max} mark={props.mark} order={props.order} />
      </div>
      {props.note && <p className="text-sm text-muted">{props.note}</p>}
      {props.children && <dl className="mt-1 space-y-1">{props.children}</dl>}
    </li>
  );
}

function verdict(result: AttemptResult, passMark: number, sections: Section[]) {
  if (result.status === 'provisional' || result.total === null) return 'Chưa đủ đáp án để kết luận đỗ hay trượt.';
  if (result.status === 'pass')
    return `Đỗ. Tổng điểm vượt mốc ${passMark} và ${sections.length === 2 ? 'cả hai' : 'cả ba'} phần đều qua điểm sàn.`;
  const minOf = (g: Group) => sections.find((s) => s.group === g)?.min ?? 0;
  const why = [
    ...(result.total < passMark ? [`tổng điểm thiếu ${passMark - result.total} so với mốc ${passMark}`] : []),
    ...result.groups.filter((g) => g.scaled !== null && g.scaled < minOf(g.group)).map((g) => `${GROUP_VI[g.group]} dưới mốc ${minOf(g.group)}`),
  ];
  return `Chưa đỗ: ${why.join(', ')}.`;
}

function ScoreSlip({ attempt, exam }: { attempt: AttemptDetail; exam: PublicExam }) {
  const { result } = attempt;
  const full = isFullExam(attempt.parts);
  const passMark = passTotal(exam.level);
  const sections = sectionsOf(exam.level);
  const correct = result.parts.reduce((s, p) => s + p.correct, 0);
  const graded = result.parts.reduce((s, p) => s + p.total, 0);
  const duration = (attempt.submittedAt - attempt.startedAt) / 1000;
  const partsOf = (s: Section) => result.parts.filter((p) => s.parts.includes(p.part));
  // part practice: a section only gets a scaled score when all of its parts were taken (e.g. vocab + grammar)
  const covered = (s: Section) => s.parts.every((p) => attempt.parts.includes(p));

  return (
    <section className="card relative px-5 pt-5 pb-4 sm:px-7 sm:pt-6">
      <Stamp kind={full ? result.status : 'practice'} />

      <header className="pr-28">
        <h1 className="text-[15px] font-semibold">{exam.title}</h1>
        <p className="mt-1 text-sm text-muted">{full ? 'Làm cả đề' : `Luyện ${attempt.parts.map((p) => PART_LABEL[p]).join(', ')}`}</p>
        <p className="text-sm text-muted">
          Nộp {formatDate(attempt.submittedAt)}, làm trong {formatClock(duration)}
        </p>
      </header>

      <div className="mt-7">
        <p>
          <span className="font-mincho font-bold">{full ? '総合得点' : '正答数'}</span> <span className="text-sm text-muted">{full ? 'Tổng điểm' : 'Số câu đúng'}</span>
        </p>
        <p className="mt-1 flex items-baseline gap-1.5 font-mincho tabular-nums">
          <span className="text-7xl leading-none font-extrabold">{full ? result.total === null ? BLANK : <CountUp to={result.total} /> : graded ? <CountUp to={correct} /> : BLANK}</span>
          <span className="text-xl text-muted">/{full ? TOTAL_MAX : graded || '—'}</span>
        </p>
        <div className="mt-4">
          {full ? <Gauge value={result.total} max={TOTAL_MAX} mark={passMark} /> : <Gauge value={correct} max={graded || 1} />}
        </div>
        <p className={`text-[15px] text-pretty ${full ? '' : 'mt-3'}`}>
          {full ? verdict(result, passMark, sections) : graded ? `Đúng ${Math.round((correct / graded) * 100)}% số câu đã có đáp án.` : 'Phần này chưa có đáp án để chấm.'}
        </p>
      </div>

      <ul className="mt-6 divide-y divide-line border-y border-line">
        {sections.flatMap((s, i) => {
          const g = s.group;
          const parts = partsOf(s);
          if (!parts.length) return [];
          if (full || covered(s)) {
            const gr = result.groups.find((x) => x.group === g);
            return [
              <Row key={g} jp={GROUP_LABEL[g]} vi={GROUP_VI[g]} score={gr?.scaled ?? null} max={s.max} mark={s.min} order={i + 1} note={gr?.scaled === null && parts.every((p) => p.total > 0) ? gr.reason : undefined}>
                {parts.map((p) => (
                  <PartLine key={p.part} p={p} named={parts.length > 1} />
                ))}
              </Row>,
            ];
          }
          return parts.map((p) => (
            <Row
              key={p.part}
              jp={PART_JP[p.part]}
              vi={PART_LABEL[p.part]}
              score={p.total ? p.correct : null}
              max={p.total}
              order={i + 1}
              note={p.total ? undefined : `Chưa có đáp án, đã làm ${p.answered} câu`}
            />
          ));
        })}
      </ul>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        Vạch đứng là mốc đỗ: {full ? `tổng ${passMark}, ` : ''}
        {sections.every((s) => s.min === sections[0].min) ? `mỗi phần ${sections[0].min}` : sections.map((s) => `${GROUP_VI[s.group].toLowerCase()} ${s.min}`).join(', ')}. Điểm quy đổi ở đây chỉ là ước lượng, kỳ thi thật chuẩn hoá điểm theo cách khác.
      </p>
    </section>
  );
}

const TABS = [
  { id: 'marks', jp: '採点', vi: 'Chấm điểm' },
  { id: 'explain', jp: '解説', vi: 'Giải thích' },
  { id: 'words', jp: '語彙・文法', vi: 'Từ và ngữ pháp' },
] as const;
type Tab = (typeof TABS)[number]['id'];

function ResultView({ attempt, exam }: { attempt: AttemptDetail; exam: PublicExam }) {
  const { result } = attempt;
  const [open, setOpen] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'marks';

  // the score does not wait for the notes: they load beside it and the tabs fill in when they arrive
  const [notes, setNotes] = useState<MondaiNotes[] | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const loadNotes = useCallback(() => {
    setNotesError(null);
    api.attemptNotes(attempt.id).then(setNotes, (e: Error) => setNotesError(e.message));
  }, [attempt.id]);
  useEffect(loadNotes, [loadNotes]);
  const notesByMondai = useMemo(() => new Map((notes ?? []).map((n) => [n.mondaiId, n])), [notes]);

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
  const opened = openReview && questionIndex.get(openReview.id);

  const actions = (
    <>
      <Link to="/" className="btn-ghost">
        Về danh sách
      </Link>
      <Link to={`/exam/${exam.id}`} className="btn-primary">
        Làm lại đề này
      </Link>
    </>
  );
  const notesPending = notesError ? (
    <ErrorBox message={notesError} onRetry={loadNotes} />
  ) : (
    <div className="h-64 animate-pulse rounded-md bg-line" role="status" aria-label="Đang tải lời giải" />
  );

  return (
    <ReviewAudioProvider exam={exam}>
      <div className="space-y-8 lg:grid lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:items-start lg:gap-12 lg:space-y-0">
        <div className="lg:sticky lg:top-20">
          <ScoreSlip attempt={attempt} exam={exam} />
          <div className="mt-5 hidden grid-cols-2 gap-3 lg:grid">{actions}</div>
        </div>

        <div className="min-w-0">
          <div className="sticky top-14 z-20 -mx-4 flex border-b border-line bg-bg/95 px-4 backdrop-blur lg:mx-0 lg:px-0" role="tablist" aria-label="Xem lại bài làm">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls="result-panel"
                onClick={() => setParams(t.id === 'marks' ? {} : { tab: t.id }, { replace: true })}
                className={`-mb-px flex-1 border-b-2 px-1 pt-2.5 pb-2 text-center transition-colors sm:flex-none sm:px-5 ${tab === t.id ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}
              >
                <span lang="ja" className="block font-mincho text-[17px] leading-tight font-bold">
                  {t.jp}
                </span>
                <span className="text-xs">{t.vi}</span>
              </button>
            ))}
          </div>

          <div id="result-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="pt-5">
            {tab === 'marks' && (
              <section>
                <p className="text-sm text-muted">Câu đúng để chìm, câu cần xem lại mới tô màu. Chọn một câu để xem lời giải.</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
                  <Legend cls={MARK.wrong} label="Sai" />
                  <Legend cls={MARK.blank} label="Bỏ trống" />
                  <Legend cls={MARK.right} label="Đúng" />
                  <Legend cls={MARK.ungraded} label="Chưa có đáp án" />
                </div>
                <div className="mt-5 space-y-6">
                  {[...reviewByPart].map(([part, items]) => {
                    const wrong = items.filter((r) => r.correct === false && r.chosen !== null).length;
                    const blank = items.filter((r) => r.correct === false && r.chosen === null).length;
                    const tally = [wrong && `sai ${wrong}`, blank && `bỏ trống ${blank}`].filter(Boolean).join(', ');
                    return (
                      <div key={part}>
                        <div className="mb-2 flex items-baseline justify-between gap-3">
                          <h3 className="font-medium">
                            {PART_LABEL[part]} <span className="font-jp text-sm font-normal text-faint">{PART_JP[part]}</span>
                          </h3>
                          <p className="text-sm text-muted">{tally || (items.some((r) => r.correct === null) ? '' : 'đúng hết')}</p>
                        </div>
                        <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-12 lg:grid-cols-10 xl:grid-cols-12">
                          {items.map((r) => {
                            const q = questionIndex.get(r.id)?.q;
                            const kind = markOf(r);
                            return (
                              <button
                                key={r.id}
                                onClick={() => setOpen(r.id)}
                                aria-label={`Câu ${q?.no ?? '?'}: ${MARK_LABEL[kind]}`}
                                className={`h-11 rounded-lg border text-sm font-semibold tabular-nums transition-colors ${MARK[kind]}`}
                              >
                                {q?.no ?? '?'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            {tab === 'explain' && (notes ? <ExplainTab exam={exam} review={result.review} notes={notesByMondai} /> : notesPending)}
            {tab === 'words' && (notes ? <StudyList exam={exam} notes={notes} parts={attempt.parts} /> : notesPending)}
          </div>
          <ReviewAudioDock />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:hidden">{actions}</div>

        <Sheet open={!!opened} onClose={() => setOpen(null)} title={opened ? `Câu ${opened.q.label ?? opened.q.no}` : ''}>
          {openReview && opened && <ReviewDetail review={openReview} q={opened.q} m={opened.m} notes={notesByMondai.get(opened.m.id)} />}
        </Sheet>
      </div>
    </ReviewAudioProvider>
  );
}

/** Right answers recede; what needs a second look carries the colour. */
const MARK: Record<Mark, string> = {
  right: 'border-line bg-surface text-muted hover:border-line-strong',
  wrong: 'border-bad-line bg-bad-soft text-bad hover:border-bad',
  blank: 'border-dashed border-bad-line bg-surface text-bad hover:border-bad',
  ungraded: 'border-dashed border-line-strong text-faint hover:border-muted',
};

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <i className={`size-3.5 rounded border ${cls}`} />
      {label}
    </span>
  );
}

function ReviewDetail({ review, q, m, notes }: { review: QuestionReview; q: PublicQuestion; m: PublicMondai; notes?: MondaiNotes }) {
  const [showPassage, setShowPassage] = useState(false);
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
          {showPassage && (
            <div className="mt-2 rounded-md bg-surface-2/60 p-3">
              <PassagePair m={m} vi={notes?.passageVi} />
            </div>
          )}
        </div>
      )}
      <QuestionExplained q={q} review={review} notes={notes} />
    </div>
  );
}
