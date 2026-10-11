import { useMemo, useState } from 'react';
import type { MondaiNotes, PublicExam, PublicMondai, PublicQuestion, QuestionNote, QuestionReview } from '../../shared/types';
import { Markup } from './Markup';

export type Mark = 'right' | 'wrong' | 'blank' | 'ungraded';
export const MARK_LABEL: Record<Mark, string> = { right: 'đúng', wrong: 'sai', blank: 'bỏ trống', ungraded: 'chưa có đáp án' };

export function markOf(r: QuestionReview): Mark {
  if (r.correct === null) return 'ungraded';
  if (r.correct) return 'right';
  return r.chosen === null ? 'blank' : 'wrong';
}

/** The passage with its translation under each line. Falls back to the passage alone when the two do not line up. */
export function PassagePair({ m, vi }: { m: PublicMondai; vi?: string }) {
  const [showVi, setShowVi] = useState(true);
  const jp = m.passage?.split('\n') ?? [];
  const lines = vi?.split('\n');
  const paired = !!lines && lines.length === jp.length;
  return (
    <div>
      {m.passage &&
        (paired && showVi ? (
          <div className="space-y-2.5">
            {jp.map((line, i) =>
              line.trim() ? (
                <p key={i}>
                  <Markup text={line} className="jp block font-mincho font-medium" />
                  <Markup text={lines[i]} className="gloss block text-[15px] text-muted" />
                </p>
              ) : null,
            )}
          </div>
        ) : (
          <Markup text={m.passage} className="jp block font-mincho font-medium" />
        ))}
      {m.image && !m.passage && <img src={m.image} alt="Tài liệu của câu hỏi" className="w-full rounded-lg bg-white" loading="lazy" />}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium text-accent">
        {paired && <button onClick={() => setShowVi((v) => !v)}>{showVi ? 'Ẩn bản dịch' : 'Hiện bản dịch'}</button>}
        {m.image && m.passage && (
          <a href={m.image} target="_blank" rel="noreferrer">
            Xem bản gốc (ảnh)
          </a>
        )}
      </div>
    </div>
  );
}

function Choices({ q, review, note }: { q: PublicQuestion; review: QuestionReview; note?: QuestionNote }) {
  const choices = q.choices.length ? q.choices : Array.from({ length: q.choiceCount }, () => '');
  return (
    <ol className="grid gap-2">
      {choices.map((c, i) => {
        const n = i + 1;
        const isAnswer = review.answer === n;
        const isChosen = review.chosen === n;
        const ungraded = review.answer === null;
        const cls = isAnswer ? 'border-good/60 bg-good/12' : isChosen ? (ungraded ? 'border-accent/60 bg-accent/10' : 'border-bad-line bg-bad-soft') : 'border-line';
        const gloss = note?.choices[i];
        return (
          <li key={n} className={`rounded-xl border px-3 py-2 ${cls}`}>
            <div className="flex min-h-7 items-center gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line-strong text-sm font-semibold">{n}</span>
              {c ? <Markup text={c} className="jp min-w-0 flex-1 leading-[1.9]" /> : <span className="flex-1" />}
              {isAnswer && <span className="shrink-0 text-xs font-semibold text-good">Đáp án</span>}
              {isChosen && !isAnswer && <span className={`shrink-0 text-xs font-semibold ${ungraded ? 'text-accent' : 'text-bad'}`}>Bạn chọn</span>}
            </div>
            {gloss && (
              <div className="gloss mt-0.5 text-sm sm:pl-10">
                <Markup text={gloss.vi} className="block" />
                {gloss.why && <Markup text={gloss.why} className="block text-muted" />}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Words and patterns tagged with this question, for looking up without leaving it. */
function QuestionWords({ no, notes }: { no: number; notes: MondaiNotes }) {
  const vocab = notes.vocab.filter((v) => v.q?.includes(no));
  const grammar = notes.grammar.filter((g) => g.q?.includes(no));
  if (!vocab.length && !grammar.length) return null;
  return (
    <details className="group text-sm">
      <summary className="cursor-pointer font-medium text-accent">
        Từ và mẫu ngữ pháp trong câu này ({vocab.length + grammar.length})
      </summary>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
        {vocab.map((v, i) => (
          <div key={`v${i}`} className="col-span-2 grid grid-cols-subgrid items-baseline">
            <dt lang="ja" className="font-mincho text-base font-semibold">
              {v.word}
              {v.reading && <span className="ml-1.5 font-jp text-xs font-normal text-muted">{v.reading}</span>}
            </dt>
            <dd className="gloss">
              <Markup text={v.meaning} /> <span className="text-xs text-faint tabular-nums">{v.level}</span>
            </dd>
          </div>
        ))}
        {grammar.map((g, i) => (
          <div key={`g${i}`} className="col-span-2 grid grid-cols-subgrid items-baseline">
            <dt lang="ja" className="font-mincho text-base font-semibold">
              {g.pattern}
            </dt>
            <dd className="gloss">
              <Markup text={g.meaning} /> <span className="text-xs text-faint tabular-nums">{g.level}</span>
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** One question as the answer booklet prints it: the sentence, every choice with its reason, then the worked answer. */
export function QuestionExplained({ q, review, notes }: { q: PublicQuestion; review: QuestionReview; notes?: MondaiNotes }) {
  const note = notes?.questions.find((n) => n.id === q.id);
  const stem = note?.filled ?? q.stem;
  return (
    <div className="space-y-3">
      {(stem || note) && (
        <div>
          {stem && <Markup text={stem} className="jp block" />}
          {note && <Markup text={note.stemVi} className="gloss block text-[15px] text-muted" />}
        </div>
      )}
      {q.image && <img src={q.image} alt="" className="w-full rounded-xl bg-white sm:max-w-md" loading="lazy" />}
      <Choices q={q} review={review} note={note} />
      {review.chosen === null && <p className="text-sm text-bad">Bạn chưa chọn câu này.</p>}
      {review.answer === null && <p className="text-sm text-warn">Câu này chưa có đáp án.</p>}
      {note ? (
        <div className="space-y-2 border-l-2 border-ink pl-3">
          <p className="gloss text-[15px]">
            <span lang="ja" className="mr-2 font-mincho font-bold">
              解説
            </span>
            <Markup text={note.explain} />
          </p>
          {note.evidence && (
            <p>
              <span className="text-sm text-muted">Căn cứ trong bài: </span>
              <Markup text={note.evidence} className="jp font-mincho text-base font-medium" />
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-faint">Câu này chưa có lời giải.</p>
      )}
      {notes && <QuestionWords no={q.no} notes={notes} />}
    </div>
  );
}

const MARK_TEXT: Record<Mark, string> = { right: 'text-good', wrong: 'text-bad', blank: 'text-bad', ungraded: 'text-faint' };

/** Every question of the attempt with its translation and worked answer, the ones to revisit first. */
export function ExplainTab({ exam, review, notes }: { exam: PublicExam; review: QuestionReview[]; notes: Map<string, MondaiNotes> }) {
  const byId = useMemo(() => new Map(review.map((r) => [r.id, r])), [review]);
  const revisit = review.filter((r) => r.correct === false).length;
  const [all, setAll] = useState(revisit === 0);

  const sections = exam.mondai
    .map((m) => ({ m, qs: m.questions.filter((q) => byId.has(q.id) && (all || byId.get(q.id)!.correct === false)) }))
    .filter((s) => s.qs.length);

  return (
    <div>
      <div className="flex gap-2" role="group" aria-label="Lọc câu">
        {[
          { on: false, label: `Sai và bỏ trống (${revisit})`, disabled: revisit === 0 },
          { on: true, label: `Tất cả (${review.length})`, disabled: false },
        ].map((o) => (
          <button
            key={o.label}
            disabled={o.disabled}
            aria-pressed={all === o.on}
            onClick={() => setAll(o.on)}
            className={`chip transition-colors disabled:opacity-40 ${all === o.on ? 'border-ink bg-ink text-surface' : 'bg-surface hover:border-line-strong'}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-8">
        {sections.map(({ m, qs }, i) => {
          const prev = sections[i - 1]?.m;
          const n = notes.get(m.id);
          return (
            <section key={m.id} className="space-y-3">
              {(!prev || prev.number !== m.number || prev.part !== m.part) && (
                <header className="border-t-2 border-ink pt-3">
                  <h3 lang="ja" className="font-mincho text-xl font-extrabold">
                    問題{m.number}
                  </h3>
                  <Markup text={m.instruction} className="jp mt-1 block text-[0.95rem] leading-[1.8] text-muted" />
                  {n && <Markup text={n.instructionVi} className="gloss block text-sm text-muted" />}
                </header>
              )}
              {m.title && <p className="font-jp text-sm font-semibold text-muted">{m.title}</p>}
              {(m.passage || m.image) && (
                <div className="card p-4 sm:p-5">
                  <PassagePair m={m} vi={n?.passageVi} />
                </div>
              )}
              <div className="card divide-y divide-line">
                {qs.map((q) => {
                  const r = byId.get(q.id)!;
                  const mark = markOf(r);
                  return (
                    <article key={q.id} className="p-4 sm:p-5">
                      <p className="mb-2 flex items-center gap-2.5">
                        <span className="grid h-7 min-w-7 place-items-center rounded-[4px] border border-ink px-1.5 text-sm font-semibold tabular-nums">{q.label ?? q.no}</span>
                        <span className={`text-sm font-semibold ${MARK_TEXT[mark]}`}>{MARK_LABEL[mark].replace(/^./, (c) => c.toUpperCase())}</span>
                      </p>
                      <QuestionExplained q={q} review={r} notes={n} />
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
