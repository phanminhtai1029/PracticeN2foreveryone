import { describe, it, expect } from 'vitest';
import { parseMarkup } from '../shared/markup';

describe('parseMarkup', () => {
  it('plain text', () => expect(parseMarkup('昨日')).toEqual([{ t: 'text', v: '昨日' }]));
  it('ruby', () =>
    expect(parseMarkup('{腕|うで}が')).toEqual([
      { t: 'ruby', base: '腕', rt: 'うで' },
      { t: 'text', v: 'が' },
    ]));
  it('underline containing ruby', () =>
    expect(parseMarkup('<u>{腕|うで}</u>')).toEqual([{ t: 'u', children: [{ t: 'ruby', base: '腕', rt: 'うで' }] }]));
  it('bold and newline', () =>
    expect(parseMarkup('**A**\nB')).toEqual([
      { t: 'b', children: [{ t: 'text', v: 'A' }] },
      { t: 'br' },
      { t: 'text', v: 'B' },
    ]));
  it('unclosed tokens stay literal', () =>
    expect(parseMarkup('{abc <u>x')).toEqual([{ t: 'text', v: '{abc <u>x' }]));
  it('empty string', () => expect(parseMarkup('')).toEqual([]));
});
