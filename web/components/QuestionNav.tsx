import type { Answers, PublicMondai } from '../../shared/types';
import { AnswerSheet } from './AnswerSheet';
import { Sheet } from './ui';

interface Props {
  open: boolean;
  onClose: () => void;
  mondai: PublicMondai[];
  answers: Answers;
  activeId?: string | null;
  onJump: (questionId: string) => void;
}

/** The answer sheet as a bottom sheet, for screens too narrow to keep it beside the booklet. */
export function QuestionNav({ open, onClose, mondai, answers, activeId, onJump }: Props) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <>
          <span className="font-mincho font-extrabold" lang="ja">
            解答用紙
          </span>{' '}
          <span className="text-base font-medium text-muted">Phiếu trả lời</span>
        </>
      }
    >
      <p className="mb-4 text-sm text-muted">Ô tô đậm là đáp án bạn đã chọn. Chọn một dòng để tới câu đó.</p>
      <AnswerSheet mondai={mondai} answers={answers} activeId={activeId} onJump={onJump} roomy />
    </Sheet>
  );
}
