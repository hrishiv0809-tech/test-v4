import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Tiny markdown renderer for announcement bodies (FastAPI stores markdown).
 * Deliberately dependency-free and safe: it builds React elements instead of
 * using dangerouslySetInnerHTML, so raw HTML in a post can never execute.
 * Supports: #/##/### headings, - and 1. lists, **bold**, *italic*, `code`, [links](https://…)
 */
type InlineToken = { type: 'text' | 'bold' | 'italic' | 'code' | 'link'; value: string; href?: string };

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) tokens.push({ type: 'text', value: text.slice(lastIndex, index) });
    const raw = match[0];
    if (raw.startsWith('**')) tokens.push({ type: 'bold', value: raw.slice(2, -2) });
    else if (raw.startsWith('`')) tokens.push({ type: 'code', value: raw.slice(1, -1) });
    else if (raw.startsWith('[')) {
      const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(raw);
      tokens.push({ type: 'link', value: linkMatch?.[1] ?? raw, href: linkMatch?.[2] ?? '#' });
    } else tokens.push({ type: 'italic', value: raw.slice(1, -1) });
    lastIndex = index + raw.length;
  }
  if (lastIndex < text.length) tokens.push({ type: 'text', value: text.slice(lastIndex) });
  return tokens;
}

function isSafeHref(href: string | undefined): boolean {
  if (!href) return false;
  return /^https?:\/\//i.test(href) || href.startsWith('/') || href.startsWith('#') || href.startsWith('mailto:');
}

function Inline({ text }: { text: string }): JSX.Element {
  return (
    <>
      {parseInline(text).map((token, index) => {
        switch (token.type) {
          case 'bold':
            return <strong key={index} className="font-semibold text-foreground">{token.value}</strong>;
          case 'italic':
            return <em key={index}>{token.value}</em>;
          case 'code':
            return <code key={index} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">{token.value}</code>;
          case 'link':
            return isSafeHref(token.href) ? (
              <a key={index} href={token.href} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">
                {token.value}
              </a>
            ) : (
              <span key={index}>{token.value}</span>
            );
          default:
            return <React.Fragment key={index}>{token.value}</React.Fragment>;
        }
      })}
    </>
  );
}

export function Markdown({ content, className }: { content: string; className?: string }): JSX.Element {
  const blocks = React.useMemo(() => {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const nodes: JSX.Element[] = [];
    let listBuffer: string[] = [];
    let orderedBuffer: string[] = [];

    const flushLists = (): void => {
      if (listBuffer.length) {
        nodes.push(
          <ul key={`ul-${nodes.length}`} className="ml-5 list-disc space-y-1">
            {listBuffer.map((item, i) => (
              <li key={i}><Inline text={item} /></li>
            ))}
          </ul>,
        );
        listBuffer = [];
      }
      if (orderedBuffer.length) {
        nodes.push(
          <ol key={`ol-${nodes.length}`} className="ml-5 list-decimal space-y-1">
            {orderedBuffer.map((item, i) => (
              <li key={i}><Inline text={item} /></li>
            ))}
          </ol>,
        );
        orderedBuffer = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) {
        flushLists();
        return;
      }
      const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
      if (heading) {
        flushLists();
        const level = heading[1].length;
        const text = <Inline text={heading[2]} />;
        if (level === 1) nodes.push(<h2 key={index} className="text-xl font-semibold">{text}</h2>);
        else if (level === 2) nodes.push(<h3 key={index} className="text-lg font-semibold">{text}</h3>);
        else nodes.push(<h4 key={index} className="text-base font-semibold">{text}</h4>);
        return;
      }
      const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
      if (bullet) {
        orderedBuffer.length && flushLists();
        listBuffer.push(bullet[1]);
        return;
      }
      const ordered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
      if (ordered) {
        listBuffer.length && flushLists();
        orderedBuffer.push(ordered[1]);
        return;
      }
      flushLists();
      nodes.push(<p key={index}><Inline text={trimmed} /></p>);
    });
    flushLists();
    return nodes;
  }, [content]);

  return <div className={cn('space-y-3 text-sm leading-relaxed text-muted-foreground', className)}>{blocks}</div>;
}
