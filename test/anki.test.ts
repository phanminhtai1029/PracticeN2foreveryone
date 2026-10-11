import { describe, it, expect } from 'vitest';
import initSqlJs from 'sql.js';
import { unzipSync, strFromU8 } from 'fflate';
import { collectAnkiNotes, markupToHtml } from '../shared/anki';
import { buildApkg } from '../shared/apkg';
import { toPublicExam } from '../shared/scoring';
import type { StudyNotes } from '../shared/types';
import { fixtureExam } from './fixtures';

const exam = () => {
  const e = toPublicExam(fixtureExam());
  e.mondai[0].questions[0].stem = '昨日から<u>{腕|うで}</u>が痛くて困っている。';
  e.mondai[2].passage = '　彼は腕を組んで考えた。それから帰った。';
  return e;
};
const notes = (): StudyNotes[] => [
  {
    mondaiId: 'mv',
    vocab: [
      { word: '腕', reading: 'うで', hanViet: 'UYỂN', pos: 'N', meaning: 'cánh tay', level: 'N3', q: [1] },
      { word: '痛い', reading: 'いたい', hanViet: 'THỐNG', pos: 'Aい', meaning: 'đau', level: 'N5', q: [1] },
    ],
    grammar: [{ pattern: '〜ている', form: 'Vて + いる', meaning: 'đang', level: 'N5', example: '困っている。', exampleVi: 'đang khổ sở', q: [1] }],
  },
  {
    mondaiId: 'mr',
    vocab: [
      { word: '腕', reading: 'うで', hanViet: 'UYỂN', pos: 'N', meaning: 'cánh tay', level: 'N3' },
      { word: '組む', reading: 'くむ', hanViet: 'TỔ', pos: 'V1', meaning: 'khoanh (tay)', level: 'N3' },
    ],
    grammar: [],
  },
];

describe('collectAnkiNotes', () => {
  it('makes one note per word, with a sentence from the exam as context', () => {
    const got = collectAnkiNotes(exam(), notes(), { kinds: ['vocab', 'grammar'], levels: [] });
    expect(got.vocab.map((n) => n.fields[0])).toEqual(['腕', '痛い', '組む']);
    // the stem of the question that uses it, furigana and underline kept
    expect(got.vocab[0].fields[6]).toBe('昨日から<u><ruby>腕<rt>うで</rt></ruby></u>が痛くて困っている。');
    // inflected forms are found by their stem: 痛くて for 痛い, 組んで for 組む
    expect(got.vocab[1].fields[6]).toContain('痛くて');
    expect(got.vocab[2].fields[6]).toBe('彼は腕を組んで考えた。');
    expect(got.vocab[0].fields[7]).toBe('Fixture, 問題1, câu 1');
    expect(got.vocab[0].tags).toEqual(['練習帳', 'N2-fx', 'N3', '語彙', '出題-文字語彙']);
    expect(got.grammar).toHaveLength(1);
  });

  it('narrows by part, kind and level', () => {
    const got = collectAnkiNotes(exam(), notes(), { parts: ['reading'], kinds: ['vocab'], levels: ['N3'] });
    expect(got.vocab.map((n) => n.fields[0])).toEqual(['腕', '組む']);
    expect(got.grammar).toEqual([]);
    expect(collectAnkiNotes(exam(), notes(), { kinds: ['vocab'], levels: ['N5'] }).vocab.map((n) => n.fields[0])).toEqual(['痛い']);
  });

  it('escapes what is not markup', () => {
    expect(markupToHtml('a < b & **c**\n{漢|かん}')).toBe('a &lt; b &amp; <b>c</b><br><ruby>漢<rt>かん</rt></ruby>');
  });
});

describe('buildApkg', () => {
  it('writes a collection Anki can read, the same from one export to the next', async () => {
    const SQL = await initSqlJs();
    const input = { deck: 'Fixture', notes: collectAnkiNotes(exam(), notes(), { kinds: ['vocab', 'grammar'], levels: [] }), now: 1_791_700_000_000 };
    const files = unzipSync(await buildApkg(SQL, input));
    expect(Object.keys(files).sort()).toEqual(['collection.anki2', 'media']);
    expect(strFromU8(files.media)).toBe('{}');

    const db = new SQL.Database(files['collection.anki2']);
    const rows = (sql: string) => db.exec(sql)[0]?.values ?? [];
    expect(rows('SELECT ver FROM col')).toEqual([[11]]);
    const decks = Object.values(JSON.parse(rows('SELECT decks FROM col')[0][0] as string) as Record<string, { name: string }>).map((d) => d.name);
    expect(decks.sort()).toEqual(['Default', '練習帳::Fixture::文法', '練習帳::Fixture::語彙']);

    const noteRows = rows('SELECT n.guid, n.flds, n.sfld, n.tags, n.csum FROM notes n JOIN cards c ON c.nid = n.id ORDER BY c.due');
    expect(noteRows).toHaveLength(4);
    expect((noteRows[0][1] as string).split('\x1f')).toHaveLength(8);
    expect(noteRows[0][2]).toBe('腕');
    expect(noteRows[0][3]).toBe(' 練習帳 N2-fx N3 語彙 出題-文字語彙 ');
    // sha1('腕') starts with these 8 hex digits
    expect(noteRows[0][4]).toBe(parseInt('bbef2b0a', 16));
    // every card belongs to a note and sits in one of the two decks
    expect(rows('SELECT COUNT(*) FROM cards c JOIN notes n ON n.id = c.nid')).toEqual([[4]]);
    expect(rows('SELECT COUNT(DISTINCT did) FROM cards')).toEqual([[2]]);
    db.close();

    const again = unzipSync(await buildApkg(SQL, { ...input, now: input.now + 86_400_000 }));
    const db2 = new SQL.Database(again['collection.anki2']);
    expect(db2.exec('SELECT id, guid FROM notes ORDER BY id')[0].values).toEqual(
      new SQL.Database(files['collection.anki2']).exec('SELECT id, guid FROM notes ORDER BY id')[0].values,
    );
  });
});
