import { allLessons, HOLDEM_COURSE } from '@/curriculum/course';
import { getProfile, getSettings, listDueSkills, listLessonProgress } from '@/db/repositories';
import type {
  DailyActivity,
  LessonProgress,
  PokerDb,
  Profile,
  Settings,
  SkillMastery,
} from '@/db/schema';
import { addDays, type LocalDay, localDay } from '@/learning/days';
import { averageMastery } from '@/learning/mastery';
import { estimatePlayerSkill } from '@/learning/skill';
import { visibleStreak } from '@/learning/streak';

const VARIANT = 'holdem-nl';
const HANDS_FOR_SKILL = 500;

export interface WeekDay {
  day: LocalDay;
  xp: number;
}

export interface Dashboard {
  profile: Profile;
  settings: Settings;
  progress: LessonProgress[];
  mastery: SkillMastery[];
  dueSkills: SkillMastery[];
  week: WeekDay[];
  todayXp: number;
  streak: number;
  handsPlayed: number;
  chipsWon: number;
  /** The player's estimated skill, from 0 to 1. Sets the Auto difficulty. */
  playerSkill: number;
}

/** Everything the main screens show, read in one go. */
export async function getDashboard(db: PokerDb, now = new Date()): Promise<Dashboard> {
  const today = localDay(now);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  const [profile, settings, progress, mastery, dueSkills, activity, hands, handsPlayed] =
    await Promise.all([
      getProfile(db, now),
      getSettings(db),
      listLessonProgress(db, VARIANT),
      db.skillMastery.where('[variantId+dueDay]').between([VARIANT, ''], [VARIANT, '￿']).toArray(),
      listDueSkills(db, VARIANT, today),
      db.dailyActivity.where('day').anyOf(days).toArray(),
      db.handHistory.orderBy('playedAt').reverse().limit(HANDS_FOR_SKILL).toArray(),
      db.handHistory.count(),
    ]);

  const byDay = new Map(activity.map((entry: DailyActivity) => [entry.day, entry.xp]));
  const decisions = hands.reduce(
    (sum, hand) => ({
      total: sum.total + (hand.decisions?.total ?? 0),
      agreed: sum.agreed + (hand.decisions?.agreed ?? 0),
    }),
    { total: 0, agreed: 0 },
  );

  return {
    profile,
    settings,
    progress,
    mastery,
    dueSkills,
    week: days.map((day) => ({ day, xp: byDay.get(day) ?? 0 })),
    todayXp: byDay.get(today) ?? 0,
    streak: visibleStreak(profile, today),
    handsPlayed,
    chipsWon: hands.reduce((sum, hand) => sum + hand.heroNet, 0),
    playerSkill: estimatePlayerSkill({
      lessonsCompleted: progress.filter((entry) => entry.status === 'completed').length,
      lessonsTotal: allLessons(HOLDEM_COURSE).length,
      averageMastery: averageMastery(mastery),
      decisions,
    }),
  };
}
