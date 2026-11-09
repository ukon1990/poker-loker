/** A card stored as `(rank - 2) * 4 + suit`, so evaluation can use cheap integer maths. */
export type Card = number & { readonly __brand: 'Card' };

/** 2–10, then 11 = jack, 12 = queen, 13 = king, 14 = ace. */
export type Rank = number;
/** Index into `SUIT_CHARS`. */
export type Suit = number;

const RANK_CHARS = '23456789TJQKA';
const SUIT_CHARS = 'shdc';

export const ALL_RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
export const ALL_SUITS: readonly Suit[] = [0, 1, 2, 3];

export function makeCard(rank: Rank, suit: Suit): Card {
  return ((rank - 2) * 4 + suit) as Card;
}

export function rankOf(card: Card): Rank {
  return (card >> 2) + 2;
}

export function suitOf(card: Card): Suit {
  return card & 3;
}

/** Parses text like `As` or `Td`. */
export function card(text: string): Card {
  const rankIndex = RANK_CHARS.indexOf(text[0] ?? '');
  const suit = SUIT_CHARS.indexOf(text[1] ?? '');
  if (text.length !== 2 || rankIndex < 0 || suit < 0) {
    throw new Error(`Invalid card: "${text}"`);
  }
  return makeCard(rankIndex + 2, suit);
}

/** Parses space-separated cards like `As Kd Tc`. An empty string gives no cards. */
export function cards(text: string): Card[] {
  return text.trim() === '' ? [] : text.trim().split(/\s+/).map(card);
}

export function formatCard(value: Card): string {
  return `${RANK_CHARS[rankOf(value) - 2]}${SUIT_CHARS[suitOf(value)]}`;
}
