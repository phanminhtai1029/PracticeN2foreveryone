import type { Answers, Part, PublicMondai, PublicQuestion } from '../../shared/types';
import { PART_JP, PART_LABEL } from '../../shared/types';

interface Props {
  mondai: PublicMondai[];
  answers: Answers;
  activeId?: string | null;
  onJump: (questionId: string) => void;
  /** taller rows and three columns, for touch */
  roomy?: boolean;
}

/** The answer sheet (解答用紙): one row of ovals per question, grouped by 問題 as on the real sheet. A row jumps to its question. */
export function AnswerSheet({ mondai, answers, activeId, onJump, roomy = false }: Props) {
  // entries that share a part and 問題 number (the reading passages of one 問題) form one block
  const blocks: { part: Part; number: number; questions: PublicQuestion[]; newPart: boolean }[] = [];
  for (const m of mondai) {
    const last = blocks[blocks.length - 1];
    if (last && last.part === m.part && last.number === m.number) last.questions = [...last.questions, ...m.questions];
    else blocks.push({ part: m.part, number: m.number, questions: m.questions, newPart: !last || last.part !== m.part });
  }

  return (
    <div>
      {blocks.map((b, i) => (
        <section key={`${b.part}-${b.number}`} className={b.newPart && i > 0 ? 'mt-5' : 'mt-2.5 first:mt-0'}>
          {b.newPart && (
            <h3 className="mb-2 border-b border-ink pb-1 text-sm font-semibold">
              {PART_LABEL[b.part]} <span className="font-jp text-xs font-normal text-faint">{PART_JP[b.part]}</span>
            </h3>
          )}
          <p className="font-jp text-xs text-faint">問題{b.number}</p>
          <div className={`mt-0.5 gap-x-3 ${roomy ? 'columns-3' : 'columns-2'}`}>
            {b.questions.map((q) => {
              const chosen = answers[q.id];
              return (
                <button
                  key={q.id}
                  data-q={q.id}
                  onClick={() => onJump(q.id)}
                  aria-label={`Câu ${q.label ?? q.no}: ${chosen ? `đã chọn ${chosen}` : 'chưa làm'}`}
                  className={`flex w-full break-inside-avoid items-center rounded px-1 transition-colors hover:bg-surface-2 ${roomy ? 'h-9 gap-1.5' : 'h-6 gap-1'} ${activeId === q.id ? 'bg-accent/10' : ''}`}
                >
                  <span className="w-6 shrink-0 text-right text-xs font-semibold text-muted tabular-nums">{q.no}</span>
                  {Array.from({ length: q.choiceCount }, (_, k) => (
                    <i key={k} className={`rounded-full border ${roomy ? 'h-5 w-3' : 'h-4 w-2.5'} ${chosen === k + 1 ? 'border-accent bg-accent' : 'border-line-strong'}`} />
                  ))}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
