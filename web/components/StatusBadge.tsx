import type { AttemptResult } from '../../shared/types';

const STYLE: Record<AttemptResult['status'], [string, string]> = {
  pass: ['Đỗ', 'bg-good/15 text-good'],
  fail: ['Trượt', 'bg-bad/15 text-bad'],
  provisional: ['Tạm tính', 'bg-warn/15 text-warn'],
};

export function StatusBadge({ status, className = '' }: { status: AttemptResult['status']; className?: string }) {
  const [label, cls] = STYLE[status];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls} ${className}`}>{label}</span>;
}
