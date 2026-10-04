// Tiny markup for exam text:
//   {漢字|かんじ} ruby · <u>…</u> underline · **…** bold · \n line break
export type MarkupNode =
  | { t: 'text'; v: string }
  | { t: 'ruby'; base: string; rt: string }
  | { t: 'u'; children: MarkupNode[] }
  | { t: 'b'; children: MarkupNode[] }
  | { t: 'br' };

export function parseMarkup(src: string): MarkupNode[] {
  const out: MarkupNode[] = [];
  let text = '';
  const flush = () => {
    if (text) out.push({ t: 'text', v: text });
    text = '';
  };

  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);

    if (src[i] === '\n') {
      flush();
      out.push({ t: 'br' });
      i++;
      continue;
    }

    if (src[i] === '{') {
      const m = /^\{([^{}|\n]+)\|([^{}|\n]+)\}/.exec(rest);
      if (m) {
        flush();
        out.push({ t: 'ruby', base: m[1], rt: m[2] });
        i += m[0].length;
        continue;
      }
    }

    if (rest.startsWith('<u>')) {
      const end = src.indexOf('</u>', i + 3);
      if (end !== -1) {
        flush();
        out.push({ t: 'u', children: parseMarkup(src.slice(i + 3, end)) });
        i = end + 4;
        continue;
      }
    }

    if (rest.startsWith('**')) {
      const end = src.indexOf('**', i + 2);
      if (end !== -1) {
        flush();
        out.push({ t: 'b', children: parseMarkup(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    text += src[i];
    i++;
  }
  flush();
  return out;
}

/** Plain text (ruby base only) — for previews and search. */
export function markupToText(src: string): string {
  const walk = (nodes: MarkupNode[]): string =>
    nodes
      .map((n) => {
        if (n.t === 'text') return n.v;
        if (n.t === 'ruby') return n.base;
        if (n.t === 'br') return '\n';
        return walk(n.children);
      })
      .join('');
  return walk(parseMarkup(src));
}
