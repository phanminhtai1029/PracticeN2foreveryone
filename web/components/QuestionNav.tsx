import type { Answers, Part, PublicMondai } from '../../shared/types';
import { PART_JP, PART_LABEL } from '../../shared/types';
import { Sheet } from './ui';

interface Props {
  open: boolean;
  onClose: () => void;
  mondai: PublicMondai[];
  answers: Answers;
  onJump: (questionId: string) => void;
}

export function QuestionNav({ open, onClose, mondai, answers, onJump }: Props) {
  const byPart = new Map<Part, PublicMondai[]>();
  for (const m of mondai) byPart.set(m.part, [...(byPart.get(m.part) ?? []), m]);

  return (
    <Sheet open={open} onClose={onClose} title="Danh sách câu hỏi">
      <div className="space-y-5">
        {[...byPart].map(([part, ms]) => (
          <div key={part}>
            <p className="mb-2 text-sm font-medium text-muted">
              {PART_LABEL[part]} <span className="font-jp text-faint">{PART_JP[part]}</span>
            </p>
            {part === 'listening' ? (
              ms.map((m) => (
                <div key={m.id} className="mb-2 flex items-center gap-2">
                  <span className="w-14 shrink-0 font-jp text-xs text-faint">問題{m.number}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {m.questions.map((q) => (
                      <NavButton key={q.id} label={String(q.no)} done={!!answers[q.id]} onClick={() => onJump(q.id)} />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
                {ms.flatMap((m) => m.questions).map((q) => (
                  <NavButton key={q.id} label={String(q.no)} done={!!answers[q.id]} onClick={() => onJump(q.id)} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-5 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <i className="size-3 rounded bg-accent" /> Đã làm
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-3 rounded border border-line-strong" /> Chưa làm
        </span>
      </div>
    </Sheet>
  );
}

function NavButton({ label, done, onClick }: { label: string; done: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`h-10 min-w-10 rounded-lg text-sm font-semibold tabular-nums transition ${done ? 'bg-accent text-accent-ink' : 'border border-line-strong text-muted hover:border-accent/60'}`}
    >
      {label}
    </button>
  );
}
