import { createStore } from '@tanstack/react-store';

export interface OpenTerm {
  id: string;
  /** Looking up a word at the table adds it to review. */
  source: 'table' | 'lesson' | 'glossary';
  /** A sentence tying the word to the current hand. */
  context?: string;
}

export const termStore = createStore<OpenTerm | null>(null);

export function openTerm(term: OpenTerm): void {
  termStore.setState(() => term);
}

export function closeTerm(): void {
  termStore.setState(() => null);
}
