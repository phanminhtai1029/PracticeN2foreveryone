import { memo, useState } from 'react';
import type { Answers, PublicMondai } from '../../shared/types';
import { Markup } from './Markup';
import { QuestionCard } from './QuestionCard';

interface Props {
  m: PublicMondai;
  showHeader: boolean;
  answers: Answers;
  activeId?: string | null;
  onChoose: (questionId: string, choice: number) => void;
}

function Passage({ m }: { m: PublicMondai }) {
  const [showImage, setShowImage] = useState(!m.passage);
  return (
    <div className="card p-4 sm:p-5">
      {m.passage && !showImage && <Markup text={m.passage} className="jp block" />}
      {m.image && showImage && (
        <a href={m.image} target="_blank" rel="noreferrer" title="Mở ảnh gốc">
          <img src={m.image} alt="Tài liệu của câu hỏi" className="w-full rounded-lg bg-white" loading="lazy" />
        </a>
      )}
      {m.image && m.passage && (
        <button className="mt-4 text-sm font-medium text-accent" onClick={() => setShowImage((v) => !v)}>
          {showImage ? 'Xem dạng chữ' : 'Xem bản gốc (ảnh)'}
        </button>
      )}
    </div>
  );
}

export const MondaiBlock = memo(function MondaiBlock({ m, showHeader, answers, activeId, onChoose }: Props) {
  const hasMaterial = !!(m.passage || m.image);
  const questions = (
    <div className="space-y-3">
      {m.questions.map((q) => (
        <QuestionCard key={q.id} q={q} chosen={answers[q.id]} active={activeId === q.id} onChoose={onChoose} />
      ))}
    </div>
  );

  return (
    <section id={`m-${m.id}`} className="scroll-mt-28 space-y-3">
      {showHeader && (
        <header className="pt-4">
          <h3 className="font-jp text-base font-bold text-ink">問題{m.number}</h3>
          <Markup text={m.instruction} className="jp mt-1 block text-[0.95rem] leading-[1.8] text-muted" />
        </header>
      )}
      {m.title && <p className="font-jp text-sm font-semibold text-muted">{m.title}</p>}
      {hasMaterial ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
          <div className="lg:sticky lg:top-32 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto lg:rounded-2xl">
            <Passage m={m} />
          </div>
          {questions}
        </div>
      ) : (
        questions
      )}
    </section>
  );
});
