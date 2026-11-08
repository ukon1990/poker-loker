import { describe, expect, it } from 'vitest';
import { type Card, cards } from '@/engine/core/cards';
import { buildDeck, STANDARD_52 } from '@/engine/core/deck';
import { categoryOf, HandCategory, rankFive } from '@/engine/eval/rank';

const rank = (text: string) => rankFive(cards(text));

describe('rankFive', () => {
  it('matches the known count of every category across all 2,598,960 hands', () => {
    const deck = buildDeck(STANDARD_52);
    const tally = new Array<number>(9).fill(0);
    const hand = new Array<Card>(5);

    for (let a = 0; a < 48; a++) {
      hand[0] = deck[a];
      for (let b = a + 1; b < 49; b++) {
        hand[1] = deck[b];
        for (let c = b + 1; c < 50; c++) {
          hand[2] = deck[c];
          for (let d = c + 1; d < 51; d++) {
            hand[3] = deck[d];
            for (let e = d + 1; e < 52; e++) {
              hand[4] = deck[e];
              tally[categoryOf(rankFive(hand))]++;
            }
          }
        }
      }
    }

    expect(tally).toEqual([
      1_302_540, // high card
      1_098_240, // pair
      123_552, // two pair
      54_912, // three of a kind
      10_200, // straight
      5_108, // flush
      3_744, // full house
      624, // four of a kind
      40, // straight flush, including royal flushes
    ]);
  });

  it('orders the categories from weakest to strongest', () => {
    const ascending = [
      '2s 4h 6d 8c Ts',
      '2s 2h 6d 8c Ts',
      '2s 2h 6d 6c Ts',
      '2s 2h 2d 8c Ts',
      '2s 3h 4d 5c 6s',
      '2s 4s 6s 8s Ts',
      '2s 2h 2d 8c 8s',
      '2s 2h 2d 2c Ts',
      '2s 3s 4s 5s 6s',
    ].map(rank);

    expect(ascending).toEqual([...ascending].sort((a, b) => a - b));
    expect(new Set(ascending).size).toBe(ascending.length);
  });

  it('treats the ace as low in the wheel, making it the lowest straight', () => {
    expect(categoryOf(rank('As 2h 3d 4c 5s'))).toBe(HandCategory.Straight);
    expect(rank('As 2h 3d 4c 5s')).toBeLessThan(rank('2s 3h 4d 5c 6s'));
    expect(categoryOf(rank('As 2s 3s 4s 5s'))).toBe(HandCategory.StraightFlush);
  });

  it('does not let a straight wrap around the ace', () => {
    expect(categoryOf(rank('Qs Kh Ad 2c 3s'))).toBe(HandCategory.HighCard);
  });

  it('breaks ties by kickers', () => {
    expect(rank('As Ah Kd 7c 2s')).toBeGreaterThan(rank('Ad Ac Qd Jc Ts'));
    expect(rank('As Ah Kd 7c 3s')).toBeGreaterThan(rank('Ad Ac Kh 7d 2s'));
    expect(rank('Ks Kh 4d 4c As')).toBeGreaterThan(rank('Kd Kc 4h 4s Qs'));
    expect(rank('As Ks Js 9s 2s')).toBeGreaterThan(rank('Ah Kh Th 9h 8h'));
  });

  it('compares a full house by its three of a kind first', () => {
    expect(rank('3s 3h 3d 2c 2s')).toBeGreaterThan(rank('2d 2h 2c As Ah'));
  });

  it('ignores suits when hands are otherwise identical', () => {
    expect(rank('As Kh Qd Jc 9s')).toBe(rank('Ah Kd Qc Js 9h'));
  });

  it('is not affected by the order of the cards', () => {
    expect(rank('2s Ts 8c 2h 6d')).toBe(rank('Ts 8c 6d 2h 2s'));
  });
});
