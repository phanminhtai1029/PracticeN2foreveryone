import { useMemo, useState } from 'react';
import { collectAnkiNotes, type AnkiKind } from '../../shared/anki';
import type { Level, Part, PublicExam, StudyNotes } from '../../shared/types';
import { LEVELS, PART_JP, PART_LABEL } from '../../shared/types';
import { downloadApkg } from '../ankiExport';
import { Icon, Sheet } from './ui';

const KIND_LABEL: Record<AnkiKind, { jp: string; vi: string; unit: string }> = {
  vocab: { jp: '語彙', vi: 'Từ vựng', unit: 'thẻ từ vựng' },
  grammar: { jp: '文法', vi: 'Ngữ pháp', unit: 'thẻ ngữ pháp' },
};

const pill = (on: boolean) => `chip transition-colors ${on ? 'border-ink bg-ink text-surface' : 'bg-surface hover:border-line-strong'}`;

interface Props {
  exam: PublicExam;
  notes: StudyNotes[];
  /** exam sections that have notes, in exam order */
  available: Part[];
  /** what the list is filtered to when the sheet opens */
  initial: { part: Part | null; levels: Level[] };
}

/** Picks what goes into the deck, then saves it as an .apkg for Anki. */
export function AnkiExport({ exam, notes, available, initial }: Props) {
  const [open, setOpen] = useState(false);
  const [part, setPart] = useState<Part | null>(null);
  const [kinds, setKinds] = useState<AnkiKind[]>(['vocab', 'grammar']);
  const [levels, setLevels] = useState<Level[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const picked = useMemo(
    () => (open ? collectAnkiNotes(exam, notes, { parts: part ? [part] : available, kinds, levels }) : { vocab: [], grammar: [] }),
    [open, exam, notes, part, available, kinds, levels],
  );
  const total = picked.vocab.length + picked.grammar.length;
  const filename = `${exam.level}-${exam.id}-${part ?? 'full'}${levels.length ? `-${LEVELS.filter((l) => levels.includes(l)).join('')}` : ''}.apkg`.toLowerCase();

  const start = () => {
    setPart(initial.part);
    setLevels(initial.levels);
    setError(null);
    setSaved(null);
    setOpen(true);
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadApkg(exam.title, picked, filename);
      setSaved(filename);
    } catch (e) {
      console.error(e);
      setError('Không tạo được file. Kiểm tra mạng rồi thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="flex min-h-9 items-center gap-1.5 text-sm font-medium text-accent" onClick={start}>
        <Icon name="download" className="size-4" />
        Xuất sang Anki
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Xuất sang Anki">
        <div className="space-y-5">
          {available.length > 1 && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Lấy từ phần nào của đề</legend>
              <div className="flex flex-wrap gap-2">
                <button className={pill(part === null)} aria-pressed={part === null} onClick={() => setPart(null)}>
                  Cả đề
                </button>
                {available.map((p) => (
                  <button key={p} className={pill(part === p)} aria-pressed={part === p} onClick={() => setPart(p)}>
                    <span lang="ja" className="font-jp">
                      {PART_JP[p]}
                    </span>
                    <span className="ml-1.5">{PART_LABEL[p]}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Loại thẻ</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(KIND_LABEL) as AnkiKind[]).map((k) => {
                const on = kinds.includes(k);
                return (
                  <button key={k} className={pill(on)} aria-pressed={on} onClick={() => setKinds((cur) => (on ? cur.filter((x) => x !== k) : [...cur, k]))}>
                    <span lang="ja" className="font-jp">
                      {KIND_LABEL[k].jp}
                    </span>
                    <span className="ml-1.5">{KIND_LABEL[k].vi}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              Cấp độ <span className="font-normal text-muted">{levels.length ? '' : '(đang lấy tất cả)'}</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => {
                const on = levels.includes(l);
                return (
                  <button key={l} className={`${pill(on)} font-semibold`} aria-pressed={on} onClick={() => setLevels((cur) => (on ? cur.filter((x) => x !== l) : [...cur, l]))}>
                    {l}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <p className="border-t border-line pt-4 text-[15px]" role="status">
            {total ? (
              <>
                {(Object.keys(KIND_LABEL) as AnkiKind[])
                  .filter((k) => picked[k].length)
                  .map((k) => `${picked[k].length} ${KIND_LABEL[k].unit}`)
                  .join(' và ')}
                . <span className="text-muted">Từ xuất hiện ở nhiều bài chỉ thành một thẻ.</span>
              </>
            ) : (
              <span className="text-muted">Chưa có thẻ nào khớp. Chọn thêm loại thẻ hoặc cấp độ.</span>
            )}
          </p>

          <button className="btn-primary h-12 w-full" disabled={!total || busy} onClick={save}>
            {busy ? 'Đang tạo file…' : `Tải ${filename}`}
          </button>
          {error && <p className="text-sm text-bad">{error}</p>}
          <p className="text-sm text-pretty text-muted">
            {saved
              ? 'Đã tải xong. Mở file bằng Anki, hoặc trong Anki chọn Tệp → Nhập. Thẻ vào bộ 練習帳, chia theo đề.'
              : 'Nhập lại lần sau không tạo thẻ trùng: Anki nhận ra từ đã có, kể cả khi từ đó đến từ đề khác.'}
          </p>
        </div>
      </Sheet>
    </>
  );
}
