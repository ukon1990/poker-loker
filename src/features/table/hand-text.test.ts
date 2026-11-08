import { describe, expect, it } from 'vitest';
import { cards } from '@/engine/core/cards';
import type { HandEvent } from '@/engine/core/hand';
import { cardName, startingHandName } from '@/engine/eval/describe';
import { handLog, handSummary, positionContext } from '@/features/table/hand-text';

const NAMES = { 0: 'You', 1: 'Rook' };

describe('card words', () => {
  it('names pairs with correct plurals', () => {
    expect(startingHandName(cards('6s 6d'))).toBe('a pair of sixes');
  });

  it('names unpaired starting hands, highest first', () => {
    expect(startingHandName(cards('Jd Kc'))).toBe('king-jack offsuit');
    expect(startingHandName(cards('As Ks'))).toBe('ace-king suited');
  });

  it('names a single card', () => {
    expect(cardName(cards('Kd')[0])).toBe('king of diamonds');
  });
});

describe('handLog', () => {
  it('names the cards dealt on a street', () => {
    const events: HandEvent[] = [{ type: 'street', street: 1, cards: cards('Ks 9d 3d') }];
    expect(handLog(events, NAMES)[0].text).toBe(
      'king of spades, nine of diamonds, three of diamonds.',
    );
  });

  it('gives every line a unique id', () => {
    const event: HandEvent = { type: 'award', seat: 0, amount: 5, potIndex: 0 };
    expect(handLog([event, event], NAMES).map((line) => line.id)).toEqual([0, 1]);
  });
});

describe('handSummary', () => {
  it('leaves out the total when nobody showed cards', () => {
    expect(handSummary([{ type: 'award', seat: 0, amount: 90, potIndex: 0 }], NAMES)).toBe(
      'You win the pot.',
    );
  });
});

describe('positionContext', () => {
  it('explains the seat in words', () => {
    expect(positionContext('BTN', 'You')).toContain('you act last');
    expect(positionContext('SB', 'Rook')).toBe('Rook is posting the small blind this hand.');
  });
});
