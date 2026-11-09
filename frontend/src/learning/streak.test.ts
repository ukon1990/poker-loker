import { describe, expect, it } from 'vitest';
import { daysBetween, localDay } from '@/learning/days';
import { advanceStreak } from '@/learning/streak';

const empty = { currentStreak: 0, longestStreak: 0, lastActiveDay: null };

describe('days', () => {
  it('formats the local calendar day with padding', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('counts across month ends and daylight saving changes', () => {
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });
});

describe('advanceStreak', () => {
  it('starts at one', () => {
    expect(advanceStreak(empty, '2026-11-08')).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDay: '2026-11-08',
    });
  });

  it('does not count the same day twice', () => {
    const state = advanceStreak(empty, '2026-11-08');
    expect(advanceStreak(state, '2026-11-08')).toEqual(state);
  });

  it('extends on the next day', () => {
    const state = advanceStreak(advanceStreak(empty, '2026-11-08'), '2026-11-09');
    expect(state.currentStreak).toBe(2);
  });

  it('restarts after a missed day but keeps the longest streak', () => {
    const state = { currentStreak: 5, longestStreak: 5, lastActiveDay: '2026-11-01' };
    expect(advanceStreak(state, '2026-11-03')).toEqual({
      currentStreak: 1,
      longestStreak: 5,
      lastActiveDay: '2026-11-03',
    });
  });

  it('ignores a clock that moved backwards', () => {
    const state = { currentStreak: 3, longestStreak: 3, lastActiveDay: '2026-11-08' };
    expect(advanceStreak(state, '2026-11-07')).toEqual(state);
  });
});
