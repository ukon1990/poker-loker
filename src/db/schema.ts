import Dexie, { type Table } from 'dexie';
import type { BotProfile, DifficultyId } from '@/engine/bots/profile';
import type { TableTendencies } from '@/engine/bots/tendencies';
import type { Card } from '@/engine/core/cards';
import type { HandEvent } from '@/engine/core/hand';
import type { TableState } from '@/engine/core/table';
import type { VariantId } from '@/engine/variants/types';
import type { LocalDay } from '@/learning/days';

export const PROFILE_ID = 'me';
export const SETTINGS_ID = 'app';

export interface Profile {
  id: typeof PROFILE_ID;
  createdAt: number;
  xp: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDay: LocalDay | null;
  activeVariantId: VariantId;
}

export interface Settings {
  id: typeof SETTINGS_ID;
  dailyGoalXp: number;
  coachEnabled: boolean;
  soundEnabled: boolean;
  theme: 'system' | 'light' | 'dark';
}

export interface LessonProgress {
  variantId: VariantId;
  lessonId: string;
  status: 'started' | 'completed';
  bestScore: number;
  completedAt: number | null;
  updatedAt: number;
}

export interface SkillMastery {
  variantId: VariantId;
  skillId: string;
  box: number;
  dueDay: LocalDay;
  correct: number;
  incorrect: number;
}

export interface Attempt {
  id?: number;
  variantId: VariantId;
  lessonId: string | null;
  exerciseType: string;
  skillIds: string[];
  correct: boolean;
  answeredAt: number;
  day: LocalDay;
}

export interface DailyActivity {
  day: LocalDay;
  xp: number;
}

export interface TableConfig {
  seatCount: number;
  difficulty: DifficultyId;
  /** The skill the table was built around, fixed when the session starts. */
  targetSkill: number;
  /** One for each seat after the player's. Skill is fixed for the session. */
  bots: BotProfile[];
}

export interface TableProgress {
  table: TableState;
  tendencies: TableTendencies;
}

export interface PlaySession {
  id: string;
  variantId: VariantId;
  status: 'active' | 'finished';
  createdAt: number;
  updatedAt: number;
  handsPlayed: number;
  config: TableConfig;
  engineState: TableProgress;
}

export interface HandRecord {
  id: string;
  sessionId: string;
  variantId: VariantId;
  playedAt: number;
  seed: number;
  /** Everything needed to replay the hand. */
  events: HandEvent[];
  handNumber: number;
  heroNet: number;
  heroHole: Card[];
  board: Card[];
  /** Seat names, for reading the hand back later. */
  names: Record<number, string>;
  /** Decisions made with the coach off. These feed the Auto difficulty. */
  decisions: { total: number; agreed: number };
}

export class PokerDb extends Dexie {
  profile!: Table<Profile, string>;
  settings!: Table<Settings, string>;
  lessonProgress!: Table<LessonProgress, [string, string]>;
  skillMastery!: Table<SkillMastery, [string, string]>;
  attempts!: Table<Attempt, number>;
  dailyActivity!: Table<DailyActivity, string>;
  playSessions!: Table<PlaySession, string>;
  handHistory!: Table<HandRecord, string>;

  constructor(name = 'poker-loker') {
    super(name);
    this.version(1).stores({
      profile: 'id',
      settings: 'id',
      lessonProgress: '[variantId+lessonId], variantId',
      skillMastery: '[variantId+skillId], [variantId+dueDay]',
      attempts: '++id, variantId, day',
      dailyActivity: 'day',
      playSessions: 'id, status, updatedAt',
      handHistory: 'id, sessionId, playedAt',
    });
  }
}
