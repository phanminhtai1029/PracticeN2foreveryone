import { memo } from 'react';
import type { PublicQuestion } from '../../shared/types';
import { markupToText } from '../../shared/markup';
import { Markup } from './Markup';

interface Props {
  q: PublicQuestion;
  chosen: number | undefined;
  active?: boolean;
  onChoose: (questionId: string, choice: number) => void;
}

export const QuestionCard = memo(function QuestionCard({ q, chosen, active = false, onChoose }: Props) {
  const label = q.label ?? String(q.no);
  const textChoices = q.choices.length > 0;
  // Short choices (vocab readings, kanji) fit a 2×2 grid; sentences stay one per row.
  const compact = textChoices && q.choices.every((c) => markupToText(c).length <= 9);
  return (
    <article id={`q-${q.id}`} className={`scroll-mt-48 p-4 transition-colors sm:p-5 ${active ? 'bg-accent/8 shadow-[inset_3px_0_0_var(--color-accent)]' : ''}`}>
      <div className="flex gap-3">
        {/* boxed number, as printed in the booklet; the learner's mark goes on the choice */}
        <span className="mt-1 grid h-7 min-w-7 shrink-0 place-items-center rounded-[4px] border border-ink px-1.5 text-sm font-semibold tabular-nums">
          {label}
        </span>
        {q.stem ? (
          <Markup text={q.stem} className="jp block min-w-0 flex-1" />
        ) : (
          <span className="mt-1 text-sm text-faint">{textChoices ? 'Chọn đáp án đúng' : 'Nghe và chọn đáp án'}</span>
        )}
      </div>

      {q.image && (
        <img src={q.image} alt={`Hình của câu ${label}`} className="mt-3 w-full rounded-xl bg-white sm:max-w-md" loading="lazy" />
      )}

      {textChoices ? (
        <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-2' : ''}`}>
          {q.choices.map((c, i) => {
            const n = i + 1;
            const on = chosen === n;
            return (
              <button
                key={n}
                onClick={() => onChoose(q.id, n)}
                aria-pressed={on}
                className={`flex min-h-12 items-center rounded-xl border py-2 text-left transition ${compact ? 'gap-2 px-2.5' : 'gap-3 px-3'} ${on ? 'border-accent bg-accent/12' : 'border-line hover:border-line-strong hover:bg-surface-2/50'}`}
              >
                <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold ${on ? 'bg-accent text-accent-ink' : 'border border-line-strong text-muted'}`}>{n}</span>
                <Markup text={c} className="jp min-w-0 flex-1 leading-[1.9]" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          {Array.from({ length: q.choiceCount }, (_, i) => i + 1).map((n) => {
            const on = chosen === n;
            return (
              <button
                key={n}
                onClick={() => onChoose(q.id, n)}
                aria-pressed={on}
                aria-label={`Đáp án ${n}`}
                className={`h-12 flex-1 rounded-xl border text-lg font-semibold transition ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted hover:border-line-strong hover:bg-surface-2/50'}`}
              >
                {n}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
});
