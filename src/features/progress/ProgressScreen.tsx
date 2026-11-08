import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { SKILL_NAMES } from '@/curriculum/course';
import { dashboardQuery } from '@/db/queries';
import { MAX_BOX } from '@/learning/mastery';
import { button } from '@/ui/button';

const CHART_HEIGHT = 112;
const SKILLS_SHOWN = 5;

function dayLetter(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString('en', { weekday: 'narrow' });
}

export function ProgressScreen() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const goal = data.settings.dailyGoalXp;
  const lessons = data.progress.filter((entry) => entry.status === 'completed').length;
  const scale = Math.max(goal * 2, ...data.week.map((day) => day.xp));
  const goalHeight = (goal / scale) * CHART_HEIGHT;

  const skills = data.mastery
    .filter((entry) => !entry.skillId.startsWith('term:'))
    .sort((a, b) => a.box - b.box)
    .slice(0, SKILLS_SHOWN);

  const stats = [
    { value: data.streak, label: 'Day streak', sub: `Best ${data.profile.longestStreak}` },
    {
      value: data.profile.xp,
      label: 'Total XP',
      sub: `${lessons} ${lessons === 1 ? 'lesson' : 'lessons'}`,
    },
    {
      value: data.handsPlayed,
      label: 'Hands',
      sub: `${data.chipsWon > 0 ? '+' : ''}${data.chipsWon} chips`,
    },
  ];

  return (
    <main className="mx-auto flex max-w-[640px] flex-col gap-3.5 p-5 lg:p-8">
      <h1 className="m-0 text-[28px] leading-tight font-extrabold">Progress</h1>

      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-[14px] border border-line bg-surface p-3">
            <div className="font-card text-[30px] leading-none font-bold">{stat.value}</div>
            <div className="mt-1.5 text-[13px] font-semibold">{stat.label}</div>
            <div className="text-[13px] text-ink-2">{stat.sub}</div>
          </div>
        ))}
      </div>

      <section className="rounded-[14px] border border-line bg-surface px-4 py-3.5">
        <div className="mb-2.5 flex items-baseline justify-between">
          <h2 className="m-0 text-base font-extrabold">This week</h2>
          <span className="text-[13px] text-ink-2">XP per day · Dashed line: goal {goal}</span>
        </div>
        <div
          className="relative grid grid-cols-7 items-end border-b border-line"
          style={{ height: CHART_HEIGHT }}
        >
          <div
            className="absolute inset-x-0 border-t border-dashed border-ink-2"
            style={{ bottom: goalHeight }}
          />
          {data.week.map((day) => (
            <div
              key={day.day}
              title={`${day.day}: ${day.xp} XP`}
              className="relative flex items-end justify-center"
              style={{ height: CHART_HEIGHT }}
            >
              <div
                className="w-5 rounded-t bg-ink"
                style={{ height: (day.xp / scale) * CHART_HEIGHT }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-7 text-center text-[13px] text-ink-2">
          {data.week.map((day) => (
            <span key={day.day}>{dayLetter(day.day)}</span>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-surface px-4 py-3.5">
        <h2 className="m-0 text-base font-extrabold">Skills</h2>
        {skills.length === 0 && (
          <p className="m-0 text-[15px] text-ink-2">Finish a lesson to see your skills here.</p>
        )}
        {skills.map((skill) => (
          <div key={skill.skillId} className="flex items-center gap-2.5 text-[15px]">
            <span className="min-w-0 flex-1 font-semibold">
              {SKILL_NAMES[skill.skillId] ?? skill.skillId}
            </span>
            <span aria-hidden="true" className="flex gap-[3px]">
              {Array.from({ length: MAX_BOX }, (_, index) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: a fixed row of level markers.
                  key={index}
                  className={`h-1.5 w-3.5 rounded-[3px] ${index < skill.box ? 'bg-ink' : 'bg-line'}`}
                />
              ))}
            </span>
            <span className="w-[42px] text-right text-[13px] text-ink-2">
              {skill.box} of {MAX_BOX}
            </span>
          </div>
        ))}
        {skills.length > 0 && (
          <Link to="/review" className={button('primary', 'mt-0.5')}>
            Review weak skills
          </Link>
        )}
      </section>

      <div className="grid grid-cols-3 gap-2 lg:hidden">
        <Link to="/glossary" className={button('outline', 'px-1 text-sm')}>
          Glossary
        </Link>
        <Link to="/history" className={button('outline', 'px-1 text-sm')}>
          History
        </Link>
        <Link to="/settings" className={button('outline', 'px-1 text-sm')}>
          Settings
        </Link>
      </div>
    </main>
  );
}
