// Writes an Anki deck package (.apkg): a zip holding `collection.anki2`, an SQLite file in Anki's schema 11,
// which every Anki client still imports. SQLite itself comes from sql.js, passed in by the caller.
import { strToU8, zipSync } from 'fflate';
import type { SqlJsStatic } from 'sql.js';
import { ANKI_FIELDS, type AnkiKind, type AnkiNote } from './anki';

const SCHEMA = `
CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
CREATE INDEX ix_notes_usn on notes (usn);
CREATE INDEX ix_cards_usn on cards (usn);
CREATE INDEX ix_revlog_usn on revlog (usn);
CREATE INDEX ix_cards_nid on cards (nid);
CREATE INDEX ix_cards_sched on cards (did, queue, due);
CREATE INDEX ix_revlog_cid on revlog (cid);
CREATE INDEX ix_notes_csum on notes (csum);
`;

/** Paper and three inks, as in the app; Anki adds .nightMode on dark themes. */
const CSS = `
.card { font-family: "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Be Vietnam Pro", sans-serif; font-size: 20px; line-height: 1.6; text-align: center; color: #1c2024; background: #fcfcfd; }
.card.nightMode { color: #ececef; background: #1c1c1f; }
.word { font-family: "Shippori Mincho", "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif; font-size: 2.8em; font-weight: 600; line-height: 1.3; }
.pattern { font-family: "Shippori Mincho", "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif; font-size: 1.9em; font-weight: 700; line-height: 1.4; }
.reading { font-size: 1.25em; color: #19448e; }
.nightMode .reading { color: #9db8f0; }
.hanviet { font-size: 0.8em; letter-spacing: 0.08em; color: #62666e; }
.form { font-size: 0.9em; color: #62666e; }
.meaning { margin-top: 0.5em; font-size: 1.1em; }
.note { margin-top: 0.3em; font-size: 0.85em; color: #50545b; }
.tag { display: inline-block; padding: 0 0.4em; border: 1px solid currentColor; border-radius: 4px; font-size: 0.65em; font-weight: 600; vertical-align: 0.15em; }
.context { max-width: 30em; margin: 1em auto 0; padding-left: 0.8em; border-left: 2px solid #b9bbc6; text-align: left; font-size: 0.95em; line-height: 1.9; }
.context .vi { font-size: 0.9em; line-height: 1.6; color: #50545b; }
.source { margin-top: 1.2em; font-size: 0.65em; color: #62666e; }
.nightMode .hanviet, .nightMode .form, .nightMode .note, .nightMode .source, .nightMode .context .vi { color: #a0a3ab; }
rt { font-size: 0.55em; }
u { text-underline-offset: 4px; }
`;

const MODELS: Record<AnkiKind, { id: number; name: string; front: string; back: string }> = {
  vocab: {
    id: 1791700000101,
    name: '練習帳 語彙',
    front: '<div class="word" lang="ja">{{Word}}</div>',
    back: `{{FrontSide}}<hr id="answer">
{{#Reading}}<div class="reading" lang="ja">{{Reading}}</div>{{/Reading}}
{{#HanViet}}<div class="hanviet">{{HanViet}}</div>{{/HanViet}}
<div class="meaning"><span class="tag">{{POS}}</span> {{Meaning}}</div>
{{#Context}}<div class="context" lang="ja">{{Context}}</div>{{/Context}}
<div class="source"><span class="tag">{{Level}}</span> {{Source}}</div>`,
  },
  grammar: {
    id: 1791700000102,
    name: '練習帳 文法',
    front: '<div class="pattern" lang="ja">{{Pattern}}</div>\n<div class="context" lang="ja">{{Example}}</div>',
    back: `<div class="pattern" lang="ja">{{Pattern}}</div>
<div class="form" lang="ja">{{Form}}</div><hr id="answer">
<div class="meaning">{{Meaning}}</div>
{{#Note}}<div class="note">{{Note}}</div>{{/Note}}
<div class="context" lang="ja">{{Example}}<div class="vi" lang="vi">{{ExampleVi}}</div></div>
<div class="source"><span class="tag">{{Level}}</span> {{Source}}</div>`,
  },
};

const DECK_SUFFIX: Record<AnkiKind, string> = { vocab: '語彙', grammar: '文法' };

/** cyrb53: a 53-bit string hash, enough to give notes and decks ids that stay the same from one export to the next. */
function hash53(s: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** Ids look like the millisecond timestamps Anki uses, in a range of their own (2020 to 2023). */
const stableId = (s: string) => 1_600_000_000_000 + (hash53(s) % 100_000_000_000);

const stripHtml = (s: string) => s.replace(/<rt>.*?<\/rt>/g, '').replace(/<[^>]+>/g, '');

/** Anki's checksum of a note's first field: the first 8 hex digits of its SHA-1. */
async function fieldChecksum(text: string): Promise<number> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text)));
  return ((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) >>> 0;
}

export interface ApkgInput {
  /** shown in Anki as "練習帳::<deck>::語彙" and "…::文法" */
  deck: string;
  notes: Record<AnkiKind, AnkiNote[]>;
  now?: number;
}

/** The bytes of collection.anki2. Importing it again updates notes in place: their guids depend only on the word or pattern. */
export async function buildCollection(SQL: SqlJsStatic, { deck, notes, now = Date.now() }: ApkgInput): Promise<Uint8Array> {
  const sec = Math.floor(now / 1000);
  const kinds = (Object.keys(MODELS) as AnkiKind[]).filter((k) => notes[k].length);
  const deckName = (k: AnkiKind) => `練習帳::${deck}::${DECK_SUFFIX[k]}`;
  const deckId = (k: AnkiKind) => stableId(`deck|${deckName(k)}`);

  const deckBase = { mod: sec, lrnToday: [0, 0], revToday: [0, 0], newToday: [0, 0], timeToday: [0, 0], collapsed: false, browserCollapsed: true, desc: '', dyn: 0, conf: 1, extendNew: 10, extendRev: 50 };
  const decks: Record<string, unknown> = { 1: { ...deckBase, id: 1, name: 'Default', usn: 0 } };
  const models: Record<string, unknown> = {};
  for (const k of kinds) {
    decks[deckId(k)] = { ...deckBase, id: deckId(k), name: deckName(k), usn: -1 };
    const m = MODELS[k];
    models[m.id] = {
      id: m.id,
      name: m.name,
      type: 0,
      mod: sec,
      usn: -1,
      sortf: 0,
      did: deckId(k),
      tmpls: [{ name: 'Card 1', ord: 0, qfmt: m.front, afmt: m.back, bqfmt: '', bafmt: '', did: null, bfont: '', bsize: 0 }],
      flds: ANKI_FIELDS[k].map((name, ord) => ({ name, ord, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] })),
      css: CSS,
      latexPre: '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
      latexPost: '\\end{document}',
      latexsvg: false,
      req: [[0, 'any', [0]]],
      tags: [],
      vers: [],
    };
  }
  const conf = { activeDecks: [1], addToCur: true, collapseTime: 1200, curDeck: 1, curModel: String(MODELS[kinds[0] ?? 'vocab'].id), dueCounts: true, estTimes: true, newBury: true, newSpread: 0, nextPos: 1, sortBackwards: false, sortType: 'noteFld', timeLim: 0 };
  const dconf = {
    1: {
      id: 1, name: 'Default', mod: 0, usn: 0, dyn: false, autoplay: true, replayq: true, timer: 0, maxTaken: 60,
      new: { bury: true, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, perDay: 20, separate: true },
      lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 },
      rev: { bury: true, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, minSpace: 1, perDay: 100 },
    },
  };

  const db = new SQL.Database();
  try {
    db.run(SCHEMA);
    db.run('INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, ?)', [sec, now, now, JSON.stringify(conf), JSON.stringify(models), JSON.stringify(decks), JSON.stringify(dconf), '{}']);

    const insertNote = db.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, ?)');
    const insertCard = db.prepare('INSERT INTO cards VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, ?)');
    const used = new Set<number>();
    let due = 0;
    db.run('BEGIN');
    for (const k of kinds)
      for (const n of notes[k]) {
        let id = stableId(n.key);
        while (used.has(id)) id++;
        used.add(id);
        const guid = hash53(n.key).toString(36) + hash53(n.key, 7).toString(36);
        const sort = stripHtml(n.fields[0]);
        insertNote.run([id, guid, MODELS[k].id, sec, ` ${n.tags.join(' ')} `, n.fields.join('\x1f'), sort, await fieldChecksum(sort), '']);
        insertCard.run([id, id, deckId(k), sec, due++, '']);
      }
    db.run('COMMIT');
    insertNote.free();
    insertCard.free();
    return db.export();
  } finally {
    db.close();
  }
}

/** A complete .apkg, ready to save. No media: the cards are text only. */
export async function buildApkg(SQL: SqlJsStatic, input: ApkgInput): Promise<Uint8Array> {
  return zipSync({ 'collection.anki2': await buildCollection(SQL, input), media: strToU8('{}') });
}
