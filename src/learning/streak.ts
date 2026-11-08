import { daysBetween, type LocalDay } from '@/learning/days';

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastActiveDay: LocalDay | null;
}

/** The streak after being active on `today`. */
export function advanceStreak(state: StreakState, today: LocalDay): StreakState {
  const gap = state.lastActiveDay === null ? null : daysBetween(state.lastActiveDay, today);

  // Already counted today, or the device clock moved backwards.
  if (gap !== null && gap <= 0) return state;

  const currentStreak = gap === 1 ? state.currentStreak + 1 : 1;
  return {
    currentStreak,
    longestStreak: Math.max(state.longestStreak, currentStreak),
    lastActiveDay: today,
  };
}

/** The streak to show today: it reads zero once a whole day has been missed. */
export function visibleStreak(state: StreakState, today: LocalDay): number {
  if (state.lastActiveDay === null) return 0;
  return daysBetween(state.lastActiveDay, today) <= 1 ? state.currentStreak : 0;
}
