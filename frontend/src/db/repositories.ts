import Dexie from 'dexie';
import {
  type Attempt,
  type HandRecord,
  type LessonProgress,
  type PlaySession,
  type PokerDb,
  PROFILE_ID,
  type Profile,
  SETTINGS_ID,
  type Settings,
  type SkillMastery,
} from '@/db/schema';
import type { VariantId } from '@/engine/variants/types';
import { type LocalDay, localDay } from '@/learning/days';
import { advanceStreak } from '@/learning/streak';

const DEFAULT_SETTINGS: Settings = {
  id: SETTINGS_ID,
  dailyGoalXp: 20,
  coachEnabled: true,
  soundEnabled: true,
  theme: 'system',
};

function newProfile(now: Date): Profile {
  return {
    id: PROFILE_ID,
    createdAt: now.getTime(),
    xp: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDay: null,
    activeVariantId: 'holdem-nl',
  };
}

export async function getProfile(db: PokerDb, now = new Date()): Promise<Profile> {
  return (await db.profile.get(PROFILE_ID)) ?? newProfile(now);
}

export async function getSettings(db: PokerDb): Promise<Settings> {
  return (await db.settings.get(SETTINGS_ID)) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(
  db: PokerDb,
  patch: Partial<Omit<Settings, 'id'>>,
): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const next = { ...(await getSettings(db)), ...patch };
    await db.settings.put(next);
    return next;
  });
}

/** Adds XP and, in the same transaction, updates the streak and the day's activity. */
export async function awardXp(db: PokerDb, amount: number, now = new Date()): Promise<Profile> {
  return db.transaction('rw', db.profile, db.dailyActivity, async () => {
    const day = localDay(now);
    const profile = await getProfile(db, now);
    const next = { ...profile, ...advanceStreak(profile, day), xp: profile.xp + amount };
    await db.profile.put(next);

    const activity = await db.dailyActivity.get(day);
    await db.dailyActivity.put({ day, xp: (activity?.xp ?? 0) + amount });
    return next;
  });
}

export function listLessonProgress(db: PokerDb, variantId: VariantId): Promise<LessonProgress[]> {
  return db.lessonProgress.where('variantId').equals(variantId).toArray();
}

export async function saveLessonProgress(db: PokerDb, progress: LessonProgress): Promise<void> {
  await db.lessonProgress.put(progress);
}

export function getSkillMastery(
  db: PokerDb,
  variantId: VariantId,
  skillId: string,
): Promise<SkillMastery | undefined> {
  return db.skillMastery.get([variantId, skillId]);
}

export async function saveSkillMastery(db: PokerDb, mastery: SkillMastery): Promise<void> {
  await db.skillMastery.put(mastery);
}

export function listDueSkills(
  db: PokerDb,
  variantId: VariantId,
  today: LocalDay,
): Promise<SkillMastery[]> {
  return db.skillMastery
    .where('[variantId+dueDay]')
    .between([variantId, Dexie.minKey], [variantId, today], true, true)
    .toArray();
}

export async function recordAttempt(db: PokerDb, attempt: Attempt): Promise<void> {
  await db.attempts.add(attempt);
}

export async function savePlaySession(db: PokerDb, session: PlaySession): Promise<void> {
  await db.playSessions.put(session);
}

export function getPlaySession(db: PokerDb, id: string): Promise<PlaySession | undefined> {
  return db.playSessions.get(id);
}

export function listActivePlaySessions(db: PokerDb): Promise<PlaySession[]> {
  return db.playSessions.where('status').equals('active').reverse().sortBy('updatedAt');
}

export async function addHandRecord(db: PokerDb, hand: HandRecord): Promise<void> {
  await db.handHistory.put(hand);
}

export function listRecentHands(db: PokerDb, limit: number): Promise<HandRecord[]> {
  return db.handHistory.orderBy('playedAt').reverse().limit(limit).toArray();
}
