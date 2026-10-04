import { memo, type ReactNode } from 'react';
import { parseMarkup, type MarkupNode } from '../../shared/markup';

// Footnote markers like （注3） render small and muted, as in the printed booklet.
const NOTE = /(（注\d*）)/;

function text(v: string, key: number): ReactNode {
  if (!NOTE.test(v)) return v;
  return v.split(NOTE).map((part, j) =>
    NOTE.test(part) ? (
      <span key={`${key}-${j}`} className="align-[0.35em] text-[0.62em] text-muted">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function render(nodes: MarkupNode[]): ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.t) {
      case 'text':
        return text(n.v, i);
      case 'br':
        return <br key={i} />;
      case 'ruby':
        return (
          <ruby key={i}>
            {n.base}
            <rt>{n.rt}</rt>
          </ruby>
        );
      case 'u':
        return <u key={i}>{render(n.children)}</u>;
      case 'b':
        return (
          <strong key={i} className="font-bold text-ink">
            {render(n.children)}
          </strong>
        );
    }
  });
}

export const Markup = memo(function Markup({ text, className }: { text: string; className?: string }) {
  return <span className={className}>{render(parseMarkup(text))}</span>;
});
