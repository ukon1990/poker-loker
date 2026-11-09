import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BackupError, exportBackup, importBackup } from '@/db/backup';
import {
  awardXp,
  getProfile,
  getSettings,
  listDueSkills,
  saveSkillMastery,
  updateSettings,
} from '@/db/repositories';
import { PokerDb } from '@/db/schema';

let db: PokerDb;
let nextId = 0;

beforeEach(async () => {
  nextId += 1;
  db = new PokerDb(`test-${nextId}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe('repositories', () => {
  it('returns defaults before anything is saved', async () => {
    expect((await getProfile(db)).xp).toBe(0);
    expect((await getSettings(db)).dailyGoalXp).toBe(20);
  });

  it('keeps data after the database is closed and reopened', async () => {
    await updateSettings(db, { dailyGoalXp: 50 });
    db.close();
    await db.open();
    expect((await getSettings(db)).dailyGoalXp).toBe(50);
  });

  it('adds XP, tracks the daily total, and extends the streak on consecutive days', async () => {
    await awardXp(db, 10, new Date(2026, 10, 8, 9));
    await awardXp(db, 5, new Date(2026, 10, 8, 21));
    const profile = await awardXp(db, 7, new Date(2026, 10, 9, 8));

    expect(profile).toMatchObject({ xp: 22, currentStreak: 2, longestStreak: 2 });
    expect((await db.dailyActivity.get('2026-11-08'))?.xp).toBe(15);
    expect((await db.dailyActivity.get('2026-11-09'))?.xp).toBe(7);
  });

  it('lists only skills that are due for the given variant', async () => {
    const base = { skillId: 'a', box: 1, correct: 0, incorrect: 0 };
    await saveSkillMastery(db, { ...base, variantId: 'holdem-nl', dueDay: '2026-11-08' });
    await saveSkillMastery(db, {
      ...base,
      skillId: 'b',
      variantId: 'holdem-nl',
      dueDay: '2026-11-09',
    });

    const due = await listDueSkills(db, 'holdem-nl', '2026-11-08');
    expect(due.map((skill) => skill.skillId)).toEqual(['a']);
  });
});

describe('backup', () => {
  it('restores everything after export and wipe', async () => {
    await awardXp(db, 30, new Date(2026, 10, 8));
    await updateSettings(db, { coachEnabled: false });
    await db.attempts.add({
      variantId: 'holdem-nl',
      lessonId: 'l1',
      exerciseType: 'choice',
      skillIds: ['rankings'],
      correct: true,
      answeredAt: 1,
      day: '2026-11-08',
    });

    const backup = JSON.parse(JSON.stringify(await exportBackup(db)));
    await Promise.all(db.tables.map((table) => table.clear()));
    expect((await getProfile(db)).xp).toBe(0);

    await importBackup(db, backup);

    expect((await getProfile(db)).xp).toBe(30);
    expect((await getSettings(db)).coachEnabled).toBe(false);
    expect(await db.attempts.count()).toBe(1);
  });

  it.each([
    ['not an object', 'nope'],
    ['another app', { app: 'other', version: 1, tables: {} }],
    ['an unknown version', { app: 'poker-loker', version: 99, tables: {} }],
    ['missing tables', { app: 'poker-loker', version: 1, tables: { profile: [] } }],
  ])('rejects %s without touching data', async (_label, raw) => {
    await awardXp(db, 30);
    await expect(importBackup(db, raw)).rejects.toBeInstanceOf(BackupError);
    expect((await getProfile(db)).xp).toBe(30);
  });

  it('rolls back completely when a row cannot be written', async () => {
    await awardXp(db, 30);
    const backup = JSON.parse(JSON.stringify(await exportBackup(db)));
    // Passes the structural check, but has no primary key, so the write fails.
    backup.tables.handHistory = [{ sessionId: 'no-id' }];

    await expect(importBackup(db, backup)).rejects.toThrow();
    expect((await getProfile(db)).xp).toBe(30);
  });
});
