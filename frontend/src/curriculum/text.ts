import { getTerm } from '@/curriculum/glossary';

export type TextPart = { type: 'text'; text: string } | { type: 'term'; id: string; text: string };

const MARK = /\{([a-z0-9-]+)(?:\|([^}]+))?\}/g;

/** Splits text like `Your {flush} or {call|calling}` into plain runs and glossary links. */
export function parseText(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;

  for (const match of text.matchAll(MARK)) {
    if (match.index > cursor) parts.push({ type: 'text', text: text.slice(cursor, match.index) });
    const id = match[1];
    parts.push({ type: 'term', id, text: match[2] ?? getTerm(id).term.toLowerCase() });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) parts.push({ type: 'text', text: text.slice(cursor) });
  return parts;
}

/** The glossary ids marked in a text. */
export function markedTerms(text: string): string[] {
  return [...text.matchAll(MARK)].map((match) => match[1]);
}

/** The text with marks removed. */
export function plainText(text: string): string {
  return parseText(text)
    .map((part) => part.text)
    .join('');
}
