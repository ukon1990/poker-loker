import type { SkillMastery } from '@/db/schema';
import type { VariantId } from '@/engine/variants/types';
import { addDays, type LocalDay } from '@/learning/days';

/** Days until the next review, for boxes 1 to 5. */
const BOX_INTERVALS = [1, 2, 4, 8, 16];
export const MAX_BOX = BOX_INTERVALS.length;

/** Leitner boxes: a right answer moves up and waits longer, a wrong one moves down. */
export function updateMastery(
  previous: SkillMastery | undefined,
  variantId: VariantId,
  skillId: string,
  correct: boolean,
  today: LocalDay,
): SkillMastery {
  const box = previous ? previous.box + (correct ? 1 : -1) : correct ? 2 : 1;
  const nextBox = Math.min(MAX_BOX, Math.max(1, box));

  return {
    variantId,
    skillId,
    box: nextBox,
    dueDay: addDays(today, BOX_INTERVALS[nextBox - 1]),
    correct: (previous?.correct ?? 0) + (correct ? 1 : 0),
    incorrect: (previous?.incorrect ?? 0) + (correct ? 0 : 1),
  };
}

export function averageMastery(entries: readonly SkillMastery[]): number {
  if (entries.length === 0) return 0;
  return entries.reduce((sum, entry) => sum + entry.box / MAX_BOX, 0) / entries.length;
}
