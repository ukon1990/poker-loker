import { describe, expect, it } from 'vitest';
import { card, cards, formatCard, rankOf, suitOf } from '@/engine/core/cards';
import { combinations } from '@/engine/core/combinations';
import { buildDeck, STANDARD_52, shuffle } from '@/engine/core/deck';
import { createRng } from '@/engine/core/rng';

describe('cards', () => {
  it('round-trips every card in the deck through text', () => {
    for (const value of buildDeck(STANDARD_52)) {
      expect(card(formatCard(value))).toBe(value);
    }
  });

  it('reads rank and suit', () => {
    expect(rankOf(card('As'))).toBe(14);
    expect(rankOf(card('2c'))).toBe(2);
    expect(suitOf(card('Kd'))).toBe(suitOf(card('2d')));
  });

  it('parses lists and rejects bad input', () => {
    expect(cards('As  Kd').map(formatCard)).toEqual(['As', 'Kd']);
    expect(cards('')).toEqual([]);
    expect(() => card('Zz')).toThrow();
    expect(() => card('Asd')).toThrow();
  });
});

describe('rng', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a.nextUint32()).toBe(b.nextUint32());
  });

  it('continues the sequence from a saved state', () => {
    const rng = createRng(7);
    rng.nextUint32();
    const resumed = createRng(rng.getState());
    for (let i = 0; i < 100; i++) expect(resumed.nextUint32()).toBe(rng.nextUint32());
  });

  it('stays in range and is roughly uniform', () => {
    const rng = createRng(1);
    const buckets = new Array<number>(6).fill(0);
    for (let i = 0; i < 60_000; i++) buckets[rng.nextInt(6)]++;
    for (const count of buckets) {
      expect(count).toBeGreaterThan(9_500);
      expect(count).toBeLessThan(10_500);
    }
  });

  it('rejects an invalid range', () => {
    expect(() => createRng(1).nextInt(0)).toThrow(RangeError);
  });
});

describe('deck', () => {
  it('has 52 unique cards', () => {
    expect(new Set(buildDeck(STANDARD_52)).size).toBe(52);
  });

  it('shuffles reproducibly without losing cards or changing the input', () => {
    const deck = buildDeck(STANDARD_52);
    const original = [...deck];
    const first = shuffle(deck, createRng(5));

    expect(first).toEqual(shuffle(deck, createRng(5)));
    expect(first).not.toEqual(deck);
    expect([...first].sort((a, b) => a - b)).toEqual([...deck].sort((a, b) => a - b));
    expect(deck).toEqual(original);
  });
});

describe('combinations', () => {
  it('gives the expected count', () => {
    expect(combinations([1, 2, 3, 4, 5, 6, 7], 5)).toHaveLength(21);
  });

  it('lists each combination', () => {
    expect(combinations([1, 2, 3], 2)).toEqual([
      [1, 2],
      [1, 3],
      [2, 3],
    ]);
  });

  it('handles the edge sizes', () => {
    expect(combinations([1, 2], 0)).toEqual([[]]);
    expect(combinations([1, 2], 3)).toEqual([]);
  });
});
