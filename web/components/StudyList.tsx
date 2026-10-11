import { memo, useMemo, useState, type ReactNode } from 'react';
import type { GrammarNote, Level, Part, PublicExam, PublicMondai, StudyNotes, VocabNote } from '../../shared/types';
import { LEVELS, PARTS, PART_JP, PART_LABEL } from '../../shared/types';
import { Markup } from './Markup';
import { Icon } from './ui';

type Kind = 'vocab' | 'grammar';
/** 赤シート: what the red sheet is laid over. */
type Cover = 'none' | 'meaning' | 'reading';

const KINDS: { id: Kind; jp: string; vi: string }[] = [
  { id: 'vocab', jp: '語彙', vi: 'Từ vựng' },
  { id: 'grammar', jp: '文法', vi: 'Ngữ pháp' },
];
const COVERS: { id: Cover; label: string }[] = [
  { id: 'none', label: 'Không che' },
  { id: 'meaning', label: 'Che nghĩa' },
  { id: 'reading', label: 'Che cách đọc' },
];

/** Search ignores Vietnamese tone marks, so "trach nhiem" finds TRÁCH NHIỆM. */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();

const keyOf = (kind: Kind, e: VocabNote | GrammarNote) => (kind === 'vocab' ? `${(e as VocabNote).word}|${(e as VocabNote).reading ?? ''}` : (e as GrammarNote).pattern);
const haystack = (e: VocabNote | GrammarNote) =>
  fold('word' in e ? [e.word, e.reading, e.hanViet, e.meaning].join(' ') : [e.pattern, e.form, e.meaning, e.note].join(' '));

/** Hidden under the sheet until tapped. The text keeps its place so nothing moves when it shows. */
function Covered({ on, label, className = '', children }: { on: boolean; label: string; className?: string; children: ReactNode }) {
  const [shown, setShown] = useState(false);
  if (!on || shown) return <span className={className}>{children}</span>;
  return (
    <button onClick={() => setShown(true)} aria-label={label} className={`sheet-cover text-left ${className}`}>
      {children}
    </button>
  );
}

function LevelTag({ level, target }: { level: Level; target: string }) {
  // the exam's own level and above read as print; lower levels as pencil
  const at = LEVELS.indexOf(level) >= LEVELS.indexOf(target as Level);
  return (
    <span className={`rounded-[4px] border px-1.5 text-xs leading-5 font-semibold tabular-nums ${at ? 'border-ink text-ink' : 'border-line-strong text-muted'}`}>{level}</span>
  );
}

const Refs = ({ q }: { q?: number[] }) => (q?.length ? <span className="text-xs whitespace-nowrap text-faint">câu {q.join(', ')}</span> : null);

const VocabRow = memo(function VocabRow({ v, cover, target }: { v: VocabNote; cover: Cover; target: string }) {
  return (
    <li className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-x-3 px-4 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:px-5">
      <div className="min-w-0">
        {(v.reading || v.hanViet) && (
          <Covered on={cover === 'reading'} label="Hiện cách đọc" className="flex w-fit flex-wrap items-baseline gap-x-2 text-muted">
            {v.reading && <span className="font-jp text-xs">{v.reading}</span>}
            {v.hanViet && <span className="text-[11px] tracking-wide text-faint">{v.hanViet}</span>}
          </Covered>
        )}
        <span lang="ja" className="block font-mincho text-xl leading-snug font-semibold">
          {v.word}
        </span>
      </div>
      <div className="gloss min-w-0 text-[15px]">
        <Covered on={cover === 'meaning'} label="Hiện nghĩa">
          <span className="mr-1.5 text-xs text-faint">{v.pos}</span>
          <Markup text={v.meaning} />
        </Covered>{' '}
        <Refs q={v.q} />
      </div>
      <LevelTag level={v.level} target={target} />
    </li>
  );
});

const GrammarRow = memo(function GrammarRow({ g, cover, target }: { g: GrammarNote; cover: Cover; target: string }) {
  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex items-baseline justify-between gap-3">
        <h4 lang="ja" className="font-mincho text-lg leading-snug font-bold">
          {g.pattern}
        </h4>
        <LevelTag level={g.level} target={target} />
      </div>
      <p lang="ja" className="font-jp text-sm text-muted">
        {g.form}
      </p>
      <div className="gloss mt-1 text-[15px]">
        <Covered on={cover === 'meaning'} label="Hiện nghĩa" className="block w-fit">
          <Markup text={g.meaning} />
        </Covered>
        {g.note && (
          <Covered on={cover === 'meaning'} label="Hiện ghi chú" className="mt-0.5 block w-fit text-sm text-muted">
            <Markup text={g.note} />
          </Covered>
        )}
      </div>
      <div className="mt-2 border-l-2 border-line-strong pl-3">
        <Markup text={g.example} className="jp block text-base leading-[1.9]" />
        <Covered on={cover === 'meaning'} label="Hiện bản dịch" className="gloss block w-fit text-sm text-muted">
          <Markup text={g.exampleVi} />
        </Covered>
      </div>
      <Refs q={g.q} />
    </li>
  );
});

const pill = (on: boolean) => `chip transition-colors ${on ? 'border-ink bg-ink text-surface' : 'bg-surface hover:border-line-strong'}`;

/**
 * The exam's word notebook: every word and pattern, 問題 by 問題, with a red sheet to test yourself.
 * `parts` limits it to the sections of one attempt.
 */
export function StudyList({ exam, notes, parts }: { exam: PublicExam; notes: StudyNotes[]; parts?: Part[] }) {
  const [kind, setKind] = useState<Kind>('vocab');
  const [part, setPart] = useState<Part | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [query, setQuery] = useState('');
  const [cover, setCover] = useState<Cover>('none');
  const [once, setOnce] = useState(true);

  const groups = useMemo(() => {
    const byMondai = new Map(notes.map((n) => [n.mondaiId, n]));
    return exam.mondai.flatMap((m) => {
      const n = byMondai.get(m.id);
      return n && (!parts || parts.includes(m.part)) ? [{ m, n }] : [];
    });
  }, [exam, notes, parts]);
  const available = PARTS.filter((p) => groups.some((g) => g.m.part === p));
  const totals = { vocab: 0, grammar: 0 };
  for (const g of groups) {
    totals.vocab += g.n.vocab.length;
    totals.grammar += g.n.grammar.length;
  }

  const view = useMemo(() => {
    const q = fold(query.trim());
    const seen = new Set<string>();
    const perLevel = Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<Level, number>;
    let shown = 0;
    let repeats = 0;
    const sections: { m: PublicMondai; rows: (VocabNote | GrammarNote)[] }[] = [];
    for (const { m, n } of groups) {
      if (part && m.part !== part) continue;
      const rows: (VocabNote | GrammarNote)[] = [];
      for (const e of n[kind] as (VocabNote | GrammarNote)[]) {
        const k = keyOf(kind, e);
        if (once && seen.has(k)) {
          repeats++;
          continue;
        }
        seen.add(k);
        if (q && !haystack(e).includes(q)) continue;
        perLevel[e.level]++;
        if (levels.length && !levels.includes(e.level)) continue;
        rows.push(e);
      }
      shown += rows.length;
      if (rows.length) sections.push({ m, rows });
    }
    return { sections, perLevel, shown, repeats };
  }, [groups, kind, part, levels, query, once]);

  if (!groups.length) return <p className="card p-4 text-sm text-muted">Phần này chưa có danh sách từ vựng và ngữ pháp.</p>;

  const unit = kind === 'vocab' ? 'từ' : 'mẫu';
  return (
    <div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Loại">
        {KINDS.map((k) => (
          <button
            key={k.id}
            aria-pressed={kind === k.id}
            onClick={() => setKind(k.id)}
            className={`flex items-baseline justify-between gap-2 rounded-md border px-3.5 py-2.5 text-left transition-colors ${kind === k.id ? 'border-ink bg-surface shadow-[inset_0_-3px_0_var(--color-ink)]' : 'border-line bg-surface/50 text-muted hover:border-line-strong'}`}
          >
            <span className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
              <span lang="ja" className="font-mincho text-lg leading-tight font-bold">
                {k.jp}
              </span>
              <span className="text-xs sm:text-sm">{k.vi}</span>
            </span>
            <span className="text-sm tabular-nums">{totals[k.id]}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {available.length > 1 && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Phần thi">
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
        )}

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Cấp độ">
          {LEVELS.map((l) => {
            const on = levels.includes(l);
            return (
              <button
                key={l}
                className={pill(on)}
                aria-pressed={on}
                disabled={!view.perLevel[l] && !on}
                onClick={() => setLevels((cur) => (on ? cur.filter((x) => x !== l) : [...cur, l]))}
              >
                <span className="font-semibold">{l}</span>
                <span className={`ml-1.5 tabular-nums ${on ? '' : 'text-faint'}`}>{view.perLevel[l]}</span>
              </button>
            );
          })}
        </div>

        <label className="flex h-11 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 focus-within:border-accent">
          <Icon name="search" className="size-4 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={kind === 'vocab' ? 'Tìm theo chữ, cách đọc, âm Hán Việt hoặc nghĩa' : 'Tìm mẫu ngữ pháp hoặc nghĩa'}
            aria-label="Tìm trong danh sách"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
          />
        </label>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex overflow-hidden rounded-xl border border-line" role="group" aria-label="Tấm che">
            {COVERS.filter((c) => kind === 'vocab' || c.id !== 'reading').map((c) => (
              <button
                key={c.id}
                aria-pressed={cover === c.id}
                onClick={() => setCover(c.id)}
                className={`min-h-9 px-3 text-sm transition-colors ${cover === c.id ? (c.id === 'none' ? 'bg-ink text-surface' : 'bg-shu text-white') : 'bg-surface text-muted hover:bg-surface-2'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <label className="flex min-h-9 items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={once} onChange={(e) => setOnce(e.target.checked)} className="size-4 accent-accent" />
            Mỗi {unit} chỉ hiện một lần
          </label>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted" role="status">
        {view.shown} {unit}
        {once && view.repeats > 0 && `, đã ẩn ${view.repeats} lần lặp lại`}
        {cover !== 'none' && '. Chạm vào ô đỏ để xem.'}
      </p>

      {/* remounting on a change of cover puts the sheet back over everything */}
      <div key={`${kind}-${cover === 'reading' && kind === 'grammar' ? 'none' : cover}`} className="mt-3 space-y-6">
        {view.sections.map(({ m, rows }) => (
          <section key={m.id} className="[contain-intrinsic-size:auto_30rem] [content-visibility:auto]">
            <h3 className="mb-2 flex items-baseline gap-2">
              <span lang="ja" className="font-mincho text-lg font-extrabold">
                問題{m.number}
                {m.title ? ` ${m.title}` : ''}
              </span>
              <span className="text-sm text-muted">{PART_LABEL[m.part]}</span>
              <span className="ml-auto text-sm text-faint tabular-nums">{rows.length}</span>
            </h3>
            <ul className="card divide-y divide-line">
              {rows.map((e, i) =>
                'word' in e ? <VocabRow key={i} v={e} cover={cover} target={exam.level} /> : <GrammarRow key={i} g={e} cover={cover} target={exam.level} />,
              )}
            </ul>
          </section>
        ))}
        {!view.sections.length && <p className="card p-4 text-sm text-muted">Không có {unit} nào khớp. Bỏ bớt bộ lọc hoặc đổi từ khoá.</p>}
      </div>
    </div>
  );
}
