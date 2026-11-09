import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { db } from '@/db/client';
import { activeSessionsQuery, dashboardQuery } from '@/db/queries';
import { savePlaySession } from '@/db/repositories';
import type { PlaySession } from '@/db/schema';
import {
  closestDifficulty,
  DIFFICULTY_LEVELS,
  type DifficultyId,
  targetSkill,
} from '@/engine/bots/profile';
import { createPlaySession } from '@/features/table/session';
import { button } from '@/ui/button';

const SEAT_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9];
const fieldClass =
  'min-h-12 w-full rounded-[10px] border border-line bg-surface px-3 text-base text-ink';

export function PlaySetupScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: dashboard } = useSuspenseQuery(dashboardQuery);
  const { data: sessions } = useSuspenseQuery(activeSessionsQuery);
  const autoLevel = closestDifficulty(targetSkill('auto', dashboard.playerSkill));

  const close = useMutation({
    mutationFn: (session: PlaySession) => savePlaySession(db, { ...session, status: 'finished' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: activeSessionsQuery.queryKey }),
  });

  const form = useForm({
    defaultValues: { seatCount: 6, difficulty: 'auto' as DifficultyId },
    onSubmit: async ({ value }) => {
      const session = createPlaySession({ ...value, playerSkill: dashboard.playerSkill });
      await savePlaySession(db, session);
      await queryClient.invalidateQueries({ queryKey: activeSessionsQuery.queryKey });
      await navigate({ to: '/play/$sessionId', params: { sessionId: session.id } });
    },
  });

  return (
    <main className="mx-auto flex max-w-[560px] flex-col gap-5 p-5 lg:p-8">
      <h1 className="m-0 text-[28px] leading-tight font-extrabold">Play</h1>

      <form
        className="flex flex-col gap-4 rounded-[14px] border border-line bg-surface p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <h2 className="m-0 text-xl font-bold">New table</h2>

        <form.Field name="seatCount">
          {(field) => (
            <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-2">
              Players
              <select
                className={fieldClass}
                value={field.state.value}
                onChange={(event) => field.handleChange(Number(event.target.value))}
              >
                {SEAT_OPTIONS.map((count) => (
                  <option key={count} value={count}>
                    {count === 2 ? '2 (heads-up)' : count}
                  </option>
                ))}
              </select>
            </label>
          )}
        </form.Field>

        <form.Field name="difficulty">
          {(field) => (
            <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-2">
              Difficulty
              <select
                className={fieldClass}
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value as DifficultyId)}
              >
                <option value="auto">Auto ({autoLevel.label})</option>
                {DIFFICULTY_LEVELS.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </form.Field>

        <p className="m-0 text-sm text-ink-2">
          Blinds 5/10, 1,000 chips each. Auto matches the bots to your level. Every bot’s skill is
          set before the first hand. Difficulty never changes the cards you’re dealt.
        </p>

        <button type="submit" className={button()}>
          Sit down
        </button>
      </form>

      {sessions.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-xl font-bold">Your tables</h2>
          {sessions.map((session) => (
            <div key={session.id} className="flex items-stretch gap-2">
              <Link
                to="/play/$sessionId"
                params={{ sessionId: session.id }}
                className="flex min-h-[60px] min-w-0 flex-1 items-center justify-between rounded-[12px] border border-line bg-surface px-4 text-ink no-underline"
              >
                <span className="text-base font-bold">{session.config.seatCount} players</span>
                <span className="text-sm text-ink-2">
                  {session.handsPlayed} {session.handsPlayed === 1 ? 'hand' : 'hands'} ·{' '}
                  {closestDifficulty(session.config.targetSkill).label}
                </span>
              </Link>
              <button
                type="button"
                aria-label={`Close the ${session.config.seatCount} player table`}
                className={button('outline', 'min-h-[60px]')}
                onClick={() => close.mutate(session)}
              >
                Close
              </button>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
