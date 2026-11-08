import { describe, expect, it } from 'vitest';
import { type Card, cards, formatCard } from '@/engine/core/cards';
import { evaluateHand } from '@/engine/eval/evaluate';
import { categoryOf, HandCategory } from '@/engine/eval/rank';
import { getVariant } from '@/engine/variants';
import { holdemNoLimit } from '@/engine/variants/holdem';

const evaluate = (hole: string, board: string) =>
  evaluateHand(holdemNoLimit, cards(hole), cards(board));

const sortedText = (values: readonly Card[]) => values.map(formatCard).sort();

describe("Hold'em definition", () => {
  it('is available from the registry', () => {
    expect(getVariant('holdem-nl')).toBe(holdemNoLimit);
  });

  it('deals five community cards across its streets', () => {
    const total = holdemNoLimit.streets.reduce((sum, street) => sum + street.boardCards, 0);
    expect(total).toBe(5);
  });
});

describe('best hand from seven cards', () => {
  it('picks the five cards that make the best hand', () => {
    const result = evaluate('As Ks', 'Qs Js Ts 2d 2h');
    expect(categoryOf(result.rank)).toBe(HandCategory.StraightFlush);
    expect(sortedText(result.cards)).toEqual(['As', 'Js', 'Ks', 'Qs', 'Ts']);
  });

  it('lets the board play when neither hole card helps', () => {
    const result = evaluate('2c 3d', 'As Kh Qd Jc Ts');
    expect(categoryOf(result.rank)).toBe(HandCategory.Straight);
    expect(sortedText(result.cards)).toEqual(['As', 'Jc', 'Kh', 'Qd', 'Ts']);
  });

  it('uses the higher two pair out of three pairs', () => {
    const result = evaluate('Ks Kh', 'Qd Qc 2s 2h 9d');
    expect(categoryOf(result.rank)).toBe(HandCategory.TwoPair);
    expect(sortedText(result.cards)).toEqual(['9d', 'Kh', 'Ks', 'Qc', 'Qd']);
  });

  it('makes a full house from two sets of three', () => {
    const result = evaluate('8s 8h', '8d 5c 5s 5h Ad');
    expect(categoryOf(result.rank)).toBe(HandCategory.FullHouse);
    expect(evaluate('5d 5c', '8d 8c 8s 5h Ad').rank).toBe(result.rank);
  });

  it('works on the flop with only five cards', () => {
    const result = evaluate('Ah Ad', 'As 7c 2d');
    expect(categoryOf(result.rank)).toBe(HandCategory.ThreeOfAKind);
  });

  it('fails clearly when there are too few cards', () => {
    expect(() => evaluate('Ah Ad', '')).toThrow(/Cannot make a hand/);
  });
});

describe('awarding pots', () => {
  const hole = cards('2c 3d');

  it('gives the pot to the single best hand', () => {
    const awards = holdemNoLimit.awardPot(
      100,
      [
        { seat: 1, hole, rank: 10 },
        { seat: 2, hole, rank: 20 },
      ],
      [],
    );
    expect(awards).toEqual([{ seat: 2, amount: 100 }]);
  });

  it('splits ties, and gives odd chips to the earliest winners', () => {
    const awards = holdemNoLimit.awardPot(
      101,
      [
        { seat: 4, hole, rank: 20 },
        { seat: 5, hole, rank: 5 },
        { seat: 0, hole, rank: 20 },
        { seat: 2, hole, rank: 20 },
      ],
      [],
    );
    expect(awards).toEqual([
      { seat: 4, amount: 34 },
      { seat: 0, amount: 34 },
      { seat: 2, amount: 33 },
    ]);
  });

  it('never creates or loses chips', () => {
    for (let amount = 0; amount < 200; amount++) {
      const contenders = [0, 1, 2, 3, 4, 5, 6].map((seat) => ({ seat, hole, rank: 1 }));
      const paid = holdemNoLimit.awardPot(amount, contenders, []);
      expect(paid.reduce((sum, award) => sum + award.amount, 0)).toBe(amount);
    }
  });

  it('refuses a pot with no contenders', () => {
    expect(() => holdemNoLimit.awardPot(10, [], [])).toThrow();
  });
});
