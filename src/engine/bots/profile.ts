import { shuffle } from '@/engine/core/deck';
import type { Rng } from '@/engine/core/rng';

/** Personality, from 0 to 1. Independent of how skilled the bot is. */
export interface BotStyle {
  looseness: number;
  aggression: number;
  bluff: number;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  style: BotStyle;
}

export const PERSONAS: readonly Persona[] = [
  {
    id: 'mags',
    name: 'Mags',
    description: 'Patient and cautious',
    style: { looseness: 0.2, aggression: 0.3, bluff: 0.1 },
  },
  {
    id: 'rook',
    name: 'Rook',
    description: 'Picks spots and pushes',
    style: { looseness: 0.3, aggression: 0.75, bluff: 0.3 },
  },
  {
    id: 'tilda',
    name: 'Tilda',
    description: 'Hates to fold',
    style: { looseness: 0.8, aggression: 0.25, bluff: 0.15 },
  },
  {
    id: 'otto',
    name: 'Otto',
    description: 'Steady all-rounder',
    style: { looseness: 0.5, aggression: 0.5, bluff: 0.25 },
  },
  {
    id: 'wren',
    name: 'Wren',
    description: 'Plays a lot, bets a lot',
    style: { looseness: 0.75, aggression: 0.8, bluff: 0.5 },
  },
  {
    id: 'dot',
    name: 'Dot',
    description: 'Loose but friendly',
    style: { looseness: 0.65, aggression: 0.4, bluff: 0.2 },
  },
  {
    id: 'fenn',
    name: 'Fenn',
    description: 'Quiet, then bluffs',
    style: { looseness: 0.35, aggression: 0.55, bluff: 0.6 },
  },
  {
    id: 'juno',
    name: 'Juno',
    description: 'Fearless raiser',
    style: { looseness: 0.5, aggression: 0.85, bluff: 0.35 },
  },
];

export interface BotProfile {
  personaId: string;
  name: string;
  style: BotStyle;
  /** Decision quality, from 0 to 1. Fixed for the session. */
  skill: number;
}

export const DIFFICULTY_LEVELS = [
  { id: 'beginner', label: 'Beginner', skill: 0.15 },
  { id: 'casual', label: 'Casual', skill: 0.35 },
  { id: 'regular', label: 'Regular', skill: 0.55 },
  { id: 'sharp', label: 'Sharp', skill: 0.75 },
  { id: 'expert', label: 'Expert', skill: 0.92 },
] as const;

export type DifficultyLevelId = (typeof DIFFICULTY_LEVELS)[number]['id'];
export type DifficultyId = 'auto' | DifficultyLevelId;

const AUTO_STRETCH = 0.05;
const SKILL_SPREAD = 0.16;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** The skill a table should have. Auto follows the player, with a slight stretch. */
export function targetSkill(difficulty: DifficultyId, playerSkill: number): number {
  if (difficulty === 'auto') return clamp(playerSkill + AUTO_STRETCH, 0.1, 0.95);
  return DIFFICULTY_LEVELS.find((level) => level.id === difficulty)?.skill ?? 0.5;
}

/** The named level nearest to a skill value. */
export function closestDifficulty(skill: number): (typeof DIFFICULTY_LEVELS)[number] {
  return DIFFICULTY_LEVELS.reduce((best, level) =>
    Math.abs(level.skill - skill) < Math.abs(best.skill - skill) ? level : best,
  );
}

/** Picks distinct personas and sets each bot's skill just before the match. */
export function createBots(count: number, target: number, rng: Rng): BotProfile[] {
  return shuffle(PERSONAS, rng)
    .slice(0, count)
    .map((persona) => ({
      personaId: persona.id,
      name: persona.name,
      style: persona.style,
      skill: clamp(target + (rng.nextFloat() - 0.5) * SKILL_SPREAD, 0.02, 0.98),
    }));
}
