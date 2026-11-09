import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { SKILL_NAMES } from '@/curriculum/course';
import { dashboardQuery } from '@/db/queries';
import { button } from '@/ui/button';

export function PracticeScreen() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const due = data.dueSkills.length;
  const practised = data.mastery.filter((entry) => !entry.skillId.startsWith('term:'));

  return (
    <main className="mx-auto flex max-w-[640px] flex-col gap-5 p-5 lg:p-8">
      <h1 className="m-0 text-[28px] leading-tight font-extrabold">Practice</h1>

      <section className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-5">
        <h2 className="m-0 text-xl font-bold">Review</h2>
        <p className="m-0 text-base text-ink-2">
          {due > 0
            ? `${due} ${due === 1 ? 'item is' : 'items are'} due today.`
            : 'Nothing is due today. You can still go over your weakest skills.'}
        </p>
        <Link to="/review" className={button()}>
          Review weak skills
        </Link>
      </section>

      {practised.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-xl font-bold">Practise one skill</h2>
          <p className="m-0 text-[15px] text-ink-2">New cards every time.</p>
          {practised.map((entry) => (
            <Link
              key={entry.skillId}
              to="/review"
              search={{ skill: entry.skillId }}
              className="flex min-h-[52px] items-center rounded-[12px] border border-line bg-surface px-4 text-base font-semibold text-ink no-underline"
            >
              {SKILL_NAMES[entry.skillId] ?? entry.skillId}
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
