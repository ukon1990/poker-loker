export interface SkillInputs {
  lessonsCompleted: number;
  lessonsTotal: number;
  /** Average mastery across practised skills, from 0 to 1. */
  averageMastery: number;
  /** Decisions made with the coach off, and how many matched the coach's advice. */
  decisions: { total: number; agreed: number };
}

const DECISIONS_FOR_FULL_WEIGHT = 200;
const MAX_DECISION_WEIGHT = 0.6;
const MIN_DECISIONS = 20;

/**
 * Estimates the player's skill from 0 to 1. Early on this is what they have learned.
 * As they play on their own, how they actually decide counts for more.
 */
export function estimatePlayerSkill(inputs: SkillInputs): number {
  const { lessonsCompleted, lessonsTotal, averageMastery, decisions } = inputs;
  const lessonShare = lessonsTotal > 0 ? lessonsCompleted / lessonsTotal : 0;
  const knowledge = 0.6 * lessonShare + 0.4 * averageMastery;

  if (decisions.total < MIN_DECISIONS) return knowledge;

  // Agreeing with half the advice is roughly what guessing achieves, so scale from there.
  const judgement = Math.max(0, (decisions.agreed / decisions.total - 0.5) * 2);
  const weight = Math.min(decisions.total / DECISIONS_FOR_FULL_WEIGHT, 1) * MAX_DECISION_WEIGHT;
  return knowledge * (1 - weight) + judgement * weight;
}
