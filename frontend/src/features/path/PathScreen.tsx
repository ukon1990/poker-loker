import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { HOLDEM_COURSE, type Lesson, type Unit } from '@/curriculum/course';
import { dashboardQuery } from '@/db/queries';
import { currentLesson, type LessonStatus, lessonStatuses } from '@/learning/course-state';
import { button } from '@/ui/button';
import { Icon, StreakMark } from '@/ui/Icon';
import { PlayingCard } from '@/ui/PlayingCard';
import { ProgressBar } from '@/ui/ProgressBar';

const TILTS = [-3, 2, -2, 3, -2];
const SUIT_LABELS = { spade: 'Spades', heart: 'Hearts', diamond: 'Diamonds', club: 'Clubs' };

function unitCaption(unit: Unit, index: number, statuses: Map<string, LessonStatus>): string {
  const done = unit.lessons.filter((lesson) => statuses.get(lesson.id) === 'done').length;
  const locked = unit.lessons.every((lesson) => statuses.get(lesson.id) === 'locked');
  return `Unit ${index + 1} · ${SUIT_LABELS[unit.suit]} · ${locked ? 'Locked' : `${done} of ${unit.lessons.length}`}`;
}

function LessonCard({
  lesson,
  unit,
  status,
  index,
  size,
}: {
  lesson: Lesson;
  unit: Unit;
  status: LessonStatus;
  index: number;
  size: 'sm' | 'lg';
}) {
  return (
    <PlayingCard
      rank={lesson.rank}
      suit={unit.suit}
      size={size}
      back={status === 'locked' ? 'quiet' : undefined}
      ring={status === 'current' ? 'red' : undefined}
      tilt={TILTS[index]}
    />
  );
}

function PhoneLessonRow({
  lesson,
  unit,
  status,
  index,
}: {
  lesson: Lesson;
  unit: Unit;
  status: LessonStatus;
  index: number;
}) {
  const card = <LessonCard lesson={lesson} unit={unit} status={status} index={index} size="sm" />;

  if (status === 'current') {
    return (
      <div className="flex items-center gap-3.5 rounded-[14px] border border-line bg-surface p-3">
        {card}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="text-base font-bold">{lesson.title}</div>
          <Link
            to="/lesson/$lessonId"
            params={{ lessonId: lesson.id }}
            className={button('primary', 'min-h-11')}
          >
            Start lesson
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <Link
        to="/lesson/$lessonId"
        params={{ lessonId: lesson.id }}
        className="flex items-center gap-3.5 px-3 text-ink no-underline"
      >
        {card}
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold">{lesson.title}</div>
          <div className="flex items-center gap-1 text-[13px] font-semibold text-green">
            <Icon name="check" size={14} strokeWidth={3} />
            Done
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3.5 px-3">
      {card}
      <div className="min-w-0 flex-1">
        <div className="text-base font-bold text-ink-2">{lesson.title}</div>
        <div className="text-[13px] font-medium text-ink-2">Locked</div>
      </div>
    </div>
  );
}

export function PathScreen() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const statuses = lessonStatuses(HOLDEM_COURSE, data.progress);
  const next = currentLesson(HOLDEM_COURSE, data.progress);
  const goal = data.settings.dailyGoalXp;
  const streakLabel = `${data.streak} ${data.streak === 1 ? 'day' : 'days'}`;

  return (
    <>
      <h1 className="sr-only">Learn</h1>

      {/* Phone */}
      <div className="mx-auto max-w-[560px] lg:hidden">
        <header className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="font-card text-2xl leading-none font-bold">Poker Loker</div>
          <div className="flex items-center gap-3.5 text-base font-bold">
            <span className="flex items-center gap-1">
              <StreakMark />
              {streakLabel}
            </span>
            <span>{data.profile.xp} XP</span>
          </div>
        </header>

        <div className="px-5 pb-2">
          <div className="mb-1.5 flex justify-between text-[13px] font-semibold text-ink-2">
            <span>Today</span>
            <span>
              {data.todayXp} / {goal} XP
            </span>
          </div>
          <ProgressBar value={data.todayXp / goal} label="Daily goal" />
        </div>

        <main className="flex flex-col gap-3 px-5 pt-4 pb-6">
          {HOLDEM_COURSE.units.map((unit, unitIndex) => {
            const locked = unit.lessons.every((lesson) => statuses.get(lesson.id) === 'locked');
            return (
              <section
                key={unit.id}
                className={`flex flex-col gap-3 ${unitIndex > 0 ? 'border-t border-line pt-3' : ''}`}
              >
                <div className="relative">
                  {unitIndex === 0 && (
                    <Link
                      to="/glossary"
                      className="absolute -top-3.5 right-0 flex min-h-11 items-center text-[13px] font-bold text-ink"
                    >
                      Glossary
                    </Link>
                  )}
                  <div className="text-[13px] font-semibold text-ink-2">
                    {unitCaption(unit, unitIndex, statuses)}
                  </div>
                  <h2
                    className={`m-0 mt-0.5 leading-tight font-extrabold ${locked ? 'text-base text-ink-2' : 'text-[22px]'}`}
                  >
                    {unit.title}
                  </h2>
                </div>
                {!locked &&
                  unit.lessons.map((lesson, index) => (
                    <PhoneLessonRow
                      key={lesson.id}
                      lesson={lesson}
                      unit={unit}
                      index={index}
                      status={statuses.get(lesson.id) ?? 'locked'}
                    />
                  ))}
              </section>
            );
          })}
        </main>
      </div>

      {/* Desktop */}
      <div className="hidden items-start gap-8 p-8 lg:flex">
        <main className="flex min-w-0 flex-1 flex-col gap-8">
          {HOLDEM_COURSE.units.map((unit, unitIndex) => {
            const locked = unit.lessons.every((lesson) => statuses.get(lesson.id) === 'locked');
            return (
              <section key={unit.id} className="flex flex-col gap-4">
                <div>
                  <div className="text-sm font-semibold text-ink-2">
                    {unitCaption(unit, unitIndex, statuses)}
                  </div>
                  <h2
                    className={`m-0 mt-0.5 text-2xl leading-tight font-extrabold ${locked ? 'text-ink-2' : ''}`}
                  >
                    {unit.title}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-5">
                  {unit.lessons.map((lesson, index) => {
                    const status = statuses.get(lesson.id) ?? 'locked';
                    const content = (
                      <>
                        <LessonCard
                          lesson={lesson}
                          unit={unit}
                          status={status}
                          index={index}
                          size="lg"
                        />
                        <span
                          className={`text-sm leading-tight font-semibold ${status === 'locked' ? 'text-ink-2' : 'text-ink'}`}
                        >
                          {lesson.title}
                        </span>
                      </>
                    );
                    const classes =
                      'flex w-28 flex-col items-center gap-2.5 text-center no-underline';
                    return status === 'locked' ? (
                      <div key={lesson.id} className={classes}>
                        {content}
                      </div>
                    ) : (
                      <Link
                        key={lesson.id}
                        to="/lesson/$lessonId"
                        params={{ lessonId: lesson.id }}
                        className={classes}
                      >
                        {content}
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </main>

        <aside className="sticky top-8 flex w-[320px] flex-none flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-lg font-extrabold">
                <StreakMark size={20} />
                {data.streak} day streak
              </span>
              <span className="text-base font-bold">{data.profile.xp} XP</span>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-sm font-semibold text-ink-2">
                <span>Today</span>
                <span>
                  {data.todayXp} / {goal} XP
                </span>
              </div>
              <ProgressBar value={data.todayXp / goal} label="Daily goal" />
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-5">
            <div className="text-sm font-semibold text-ink-2">
              {next ? 'Up next' : 'Course finished'}
            </div>
            {next && (
              <>
                <div className="text-xl leading-tight font-extrabold">{next.title}</div>
                <Link to="/lesson/$lessonId" params={{ lessonId: next.id }} className={button()}>
                  Start lesson
                </Link>
              </>
            )}
            <Link to="/review" className={button('outline')}>
              Review weak skills
            </Link>
          </section>

          <section className="flex flex-col gap-3 rounded-[14px] bg-felt p-5 text-on-felt">
            <div className="text-xl leading-tight font-extrabold">Ready to play?</div>
            <div className="text-[15px] leading-snug text-on-felt-2">
              Bots set to your level, and a coach if you want one.
            </div>
            <Link to="/play" className={button('paper')}>
              Sit down
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
