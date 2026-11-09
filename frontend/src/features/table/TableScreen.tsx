import { useHotkey } from '@tanstack/react-hotkeys';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { db } from '@/db/client';
import { dashboardQuery, handHistoryQuery, settingsQuery } from '@/db/queries';
import { addHandRecord, savePlaySession, updateSettings } from '@/db/repositories';
import type { PlaySession } from '@/db/schema';
import type { CoachAdvice } from '@/engine/coach/coach';
import type { Action, LegalActions } from '@/engine/core/hand';
import { positionNames } from '@/engine/core/table';
import { type HandView, viewFor } from '@/engine/core/view';
import { TableController } from '@/features/table/controller';
import { workerEngine } from '@/features/table/engine-client';
import {
  handLog,
  handSummary,
  lastAction,
  POSITION_TERMS,
  positionContext,
} from '@/features/table/hand-text';
import { HERO_SEAT, seatNames } from '@/features/table/session';
import { RichText, TermLink } from '@/features/terms/RichText';
import { button } from '@/ui/button';
import { Chip } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { EmptyCardSlot, PlayingCard } from '@/ui/PlayingCard';

const BOARD_SIZE = 5;
const DESKTOP_QUERY = '(min-width: 1024px)';

function seatPlace(seat: number, seatCount: number) {
  const angle = Math.PI / 2 + (seat * 2 * Math.PI) / seatCount;
  return { x: 50 + 38 * Math.cos(angle), y: 50 + 36 * Math.sin(angle) };
}

function defaultRaise(view: HandView, legal: LegalActions): number {
  if (!legal.raise) return 0;
  const { min, max } = legal.raise;
  const unit = view.stakes.smallBlind;
  const target =
    view.street === 0
      ? view.currentBet <= view.stakes.bigBlind
        ? 3 * view.stakes.bigBlind
        : 3 * view.currentBet
      : view.currentBet + 0.75 * (view.pot + (legal.call ?? 0));
  return Math.min(max, Math.max(min, Math.round(target / unit) * unit));
}

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(DESKTOP_QUERY);
      query.addEventListener('change', notify);
      return () => query.removeEventListener('change', notify);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
  );
}

function DealerBadge({ className }: { className: string }) {
  return (
    <div
      role="img"
      aria-label="Dealer button"
      className={`absolute flex size-5 items-center justify-center rounded-full bg-white font-card text-xs font-bold text-[#15171a] ${className}`}
    >
      D
    </div>
  );
}

function Felt({
  view,
  names,
  thinking,
}: {
  view: HandView;
  names: Record<number, string>;
  thinking: number | null;
}) {
  const seats = view.players.map((player) => player.seat);
  const positions = positionNames(seats, view.buttonSeat);
  const seatCount = Math.max(...seats, 0) + 1;
  const hero = view.players.find((player) => player.seat === HERO_SEAT);
  const heroPosition = positions.get(HERO_SEAT) ?? '';
  const streetBets = view.players.reduce((sum, player) => sum + player.streetBet, 0);
  const pot = view.pot - streetBets;
  const compact = seatCount >= 7;
  const desktop = useIsDesktop();
  const dealerAtHero = view.buttonSeat === HERO_SEAT;

  return (
    <section
      aria-label="Table"
      className="relative h-[420px] rounded-[64px] bg-felt text-on-felt shadow-[inset_0_0_0_2px_rgba(255,255,255,0.14)] lg:h-[560px] lg:rounded-[280px]"
    >
      {view.players
        .filter((player) => player.seat !== HERO_SEAT)
        .map((player) => {
          const place = seatPlace(player.seat, seatCount);
          const position = positions.get(player.seat) ?? '';
          const name = names[player.seat];
          const folded = player.status === 'folded';
          const isThinking = thinking === player.seat;
          return (
            <div
              key={player.seat}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
              style={{ left: `${place.x}%`, top: `${place.y}%` }}
            >
              {!folded && (
                <div className="flex gap-0.5">
                  {player.hole
                    ? player.hole.map((card) => <PlayingCard key={card} card={card} size="xs" />)
                    : [0, 1].map((index) => <PlayingCard key={index} back="quiet" size="xxs" />)}
                </div>
              )}
              <div
                className={`relative box-border rounded-[10px] border px-2 py-1.5 text-[13px] leading-[1.35] lg:w-[136px] lg:text-[15px] ${compact ? 'w-[84px]' : 'w-24'} ${isThinking ? 'border-white' : 'border-white/20'} ${folded ? 'bg-transparent' : 'bg-white/15'}`}
              >
                {view.buttonSeat === player.seat && <DealerBadge className="-top-3 -left-3" />}
                <div className="flex justify-between gap-1 font-bold">
                  <span>{name}</span>
                  {position && POSITION_TERMS[position] && (
                    <TermLink
                      id={POSITION_TERMS[position]}
                      source="table"
                      context={positionContext(position, name)}
                      className="font-medium text-on-felt-2"
                    >
                      {position}
                    </TermLink>
                  )}
                </div>
                <div className="flex justify-between">
                  <span>{player.stack}</span>
                  <span className="text-on-felt-2">{lastAction(view.events, player.seat)}</span>
                </div>
              </div>
            </div>
          );
        })}

      {view.players
        .filter((player) => player.streetBet > 0)
        .map((player) => {
          const place = seatPlace(player.seat, seatCount);
          const left = 50 + (place.x - 50) * 0.55;
          const top = player.seat === HERO_SEAT ? 58 : 50 + (place.y - 50) * 0.55;
          return (
            <div
              key={player.seat}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <Chip value={player.streetBet} px={36} />
            </div>
          );
        })}

      <div
        className={`absolute inset-x-0 top-[33%] text-center text-base font-bold lg:top-[29%] lg:text-lg ${pot === 0 ? 'hidden' : ''}`}
      >
        <TermLink
          id="pot"
          source="table"
          context={`There are ${view.pot} chips in play this hand.`}
        >
          Pot
        </TermLink>{' '}
        {pot}
      </div>

      <div className="absolute top-[47%] left-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-1.5">
        {Array.from({ length: BOARD_SIZE }, (_, index) => {
          const card = view.board[index];
          return card === undefined ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: empty slots have nothing else to key on.
            <EmptyCardSlot key={index} size={desktop ? 'md' : 'xs'} />
          ) : (
            <PlayingCard key={card} card={card} size={desktop ? 'md' : 'xs'} />
          );
        })}
      </div>

      <div className="absolute top-[75%] left-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-1.5">
        {hero?.status === 'folded'
          ? null
          : hero?.hole?.map((card, index) => (
              <PlayingCard
                key={card}
                card={card}
                size={desktop ? 'lg' : compact ? 'sm' : 'md'}
                tilt={index === 0 ? -2 : 2}
              />
            ))}
      </div>

      <div className="absolute inset-x-0 top-[90%] flex justify-center gap-2 text-sm font-bold lg:text-base">
        <span>You</span>
        <TermLink
          id={POSITION_TERMS[heroPosition] ?? 'position'}
          source="table"
          context={positionContext(heroPosition, 'You')}
          className="font-medium text-on-felt-2"
        >
          {heroPosition}
        </TermLink>
        <span>{hero?.stack ?? 0}</span>
      </div>

      {dealerAtHero && <DealerBadge className="top-[90%] left-[30%]" />}
    </section>
  );
}

function CoachPanel({ advice }: { advice: CoachAdvice | null }) {
  const percent = (value: number) => `${Math.round(value * 100)}%`;

  return (
    <section
      aria-label="Coach"
      className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-surface px-4 py-3.5 lg:gap-3.5 lg:p-5"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="m-0 text-base font-extrabold lg:text-xl">Coach</h2>
        {advice && (
          <span className="text-[13px] font-medium text-ink-2 lg:text-sm">
            {advice.toCall > 0 ? `Call ${advice.toCall} to win ${advice.toWin}` : 'Nothing to call'}
          </span>
        )}
      </div>

      {!advice && <p className="m-0 text-[15px] text-ink-2">Advice appears on your turn.</p>}

      {advice && (
        <>
          <div className="flex items-baseline justify-between">
            {advice.needed !== null ? (
              <div>
                <span className="font-card text-[28px] leading-none font-bold lg:text-[40px]">
                  {percent(advice.needed)}
                </span>{' '}
                <span className="text-[13px] font-semibold text-ink-2">needed</span>
              </div>
            ) : (
              <span />
            )}
            <div>
              <span className="font-card text-[28px] leading-none font-bold text-green lg:text-[40px]">
                {percent(advice.equity)}
              </span>{' '}
              <span className="text-[13px] font-semibold text-ink-2">your chance</span>
            </div>
          </div>
          <div className="relative h-2.5 rounded-[5px] bg-line">
            <div
              className="h-2.5 rounded-[5px] bg-felt"
              style={{ width: percent(advice.equity) }}
            />
            {advice.needed !== null && (
              <div
                className="absolute -top-[3px] h-4 w-0.5 bg-ink"
                style={{ left: percent(advice.needed) }}
              />
            )}
          </div>
          <p className="m-0 text-[15px] leading-snug lg:text-base">
            <RichText text={advice.text} source="table" />
          </p>
          <p className="m-0 text-[13px] text-ink-2 lg:text-sm">A rule of thumb, not a solver.</p>
        </>
      )}
    </section>
  );
}

function ActionBar({
  view,
  onAct,
  thinkingName,
}: {
  view: HandView;
  onAct: (action: Action) => void;
  thinkingName: string | null;
}) {
  const { legal } = view;
  const eventCount = view.events.length;
  const [raiseTo, setRaiseTo] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new event count means a new decision.
  useEffect(() => {
    if (legal) setRaiseTo(defaultRaise(view, legal));
  }, [eventCount]);

  const canCheckOrCall = legal !== null;
  useHotkey('F', () => legal?.fold && onAct({ type: 'fold' }), { enabled: !!legal?.fold });
  useHotkey('C', () => legal && onAct(legal.check ? { type: 'check' } : { type: 'call' }), {
    enabled: canCheckOrCall,
  });
  useHotkey('R', () => legal?.raise && onAct({ type: 'raise', to: raiseTo }), {
    enabled: !!legal?.raise,
  });

  if (!legal) {
    return (
      <div className="flex min-h-14 items-center justify-center text-base font-semibold text-ink-2">
        {thinkingName ? `${thinkingName} is thinking…` : 'Waiting…'}
      </div>
    );
  }

  const raiseVerb = view.currentBet === 0 ? 'Bet' : 'Raise to';
  const isAllIn = legal.raise !== null && raiseTo === legal.raise.max;
  const hint = 'hidden font-medium opacity-70 lg:inline';

  return (
    <div className="flex flex-col gap-2">
      {legal.raise && legal.raise.max > legal.raise.min && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink-2">{legal.raise.min}</span>
          <input
            type="range"
            aria-label="Raise size"
            min={legal.raise.min}
            max={legal.raise.max}
            step={view.stakes.smallBlind}
            value={raiseTo}
            onChange={(event) => setRaiseTo(event.target.valueAsNumber)}
            className="min-w-0 flex-1 accent-[var(--ink)]"
          />
          <span className="text-sm font-semibold text-ink-2">{legal.raise.max}</span>
        </div>
      )}
      <div className="flex gap-2">
        {legal.fold && (
          <button
            type="button"
            className={button('outline', 'min-h-14 flex-1 basis-0 whitespace-nowrap px-1')}
            onClick={() => onAct({ type: 'fold' })}
          >
            Fold <span className={hint}>F</span>
          </button>
        )}
        <button
          type="button"
          className={button('primary', 'min-h-14 flex-1 basis-0 whitespace-nowrap px-1')}
          onClick={() => onAct(legal.check ? { type: 'check' } : { type: 'call' })}
        >
          {legal.check ? 'Check' : `Call ${legal.call}`} <span className={hint}>C</span>
        </button>
        {legal.raise && (
          <button
            type="button"
            className={button('outline', 'min-h-14 flex-1 basis-0 whitespace-nowrap px-1')}
            onClick={() => onAct({ type: 'raise', to: raiseTo })}
          >
            {isAllIn ? 'All-in' : `${raiseVerb} ${raiseTo}`} <span className={hint}>R</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function TableScreen({ session }: { session: PlaySession }) {
  const queryClient = useQueryClient();
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const [coachOn, setCoachOn] = useState(settings.coachEnabled);
  const coachRef = useRef(coachOn);
  coachRef.current = coachOn;

  const [controller] = useState(
    () =>
      new TableController(session, {
        engine: workerEngine,
        save: (next) => savePlaySession(db, next),
        recordHand: async (record) => {
          await addHandRecord(db, record);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: dashboardQuery.queryKey }),
            queryClient.invalidateQueries({ queryKey: handHistoryQuery.queryKey }),
          ]);
        },
        isCoachVisible: () => coachRef.current,
        pause: () => new Promise((resolve) => setTimeout(resolve, 450 + Math.random() * 600)),
      }),
  );

  useEffect(() => {
    controller.start();
    return () => controller.dispose();
  }, [controller]);

  const { table, advice, thinking } = useSelector(controller.store);
  const saveCoach = useMutation({
    mutationFn: (coachEnabled: boolean) => updateSettings(db, { coachEnabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsQuery.queryKey }),
  });

  const logRef = useRef<HTMLDivElement>(null);
  const eventCount = table.hand?.events.length ?? 0;

  // biome-ignore lint/correctness/useExhaustiveDependencies: scrolls whenever a line is added.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [eventCount]);

  const names = seatNames(session);
  const hand = table.hand;

  if (!hand) return <main className="p-8 text-center text-ink-2">Dealing…</main>;

  const view = viewFor(hand, HERO_SEAT);
  const finished = hand.result !== null;
  const heroBroke = finished && (view.players.find((p) => p.seat === HERO_SEAT)?.stack ?? 0) === 0;
  const net = hand.result?.net.find((entry) => entry.seat === HERO_SEAT)?.amount ?? 0;
  const log = handLog(hand.events, names);

  return (
    <div className="mx-auto flex min-h-app max-w-[1440px] flex-col gap-2 px-3 pb-[calc(16px+var(--safe-bottom))] lg:gap-4 lg:px-10 lg:pt-5 lg:pb-8">
      <header className="flex h-[52px] flex-none items-center gap-1 lg:h-auto lg:gap-4">
        <Link
          to="/play"
          aria-label="Leave table"
          className="flex size-11 items-center justify-center text-ink"
        >
          <Icon name="back" />
        </Link>
        <div className="flex-1 text-[15px] font-bold lg:text-base">
          Blinds {table.stakes.smallBlind}/{table.stakes.bigBlind}{' '}
          <span className="font-medium text-ink-2">· Hand {table.handNumber}</span>
        </div>
        <button
          type="button"
          aria-pressed={coachOn}
          onClick={() => {
            setCoachOn(!coachOn);
            saveCoach.mutate(!coachOn);
          }}
          className="min-h-11 rounded-[10px] bg-transparent px-3 text-sm font-bold text-ink"
        >
          Coach {coachOn ? 'on' : 'off'}
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-x-6 lg:gap-y-4">
        <main className="min-w-0 lg:col-start-1 lg:row-start-1">
          <Felt view={view} names={names} thinking={thinking} />
        </main>

        <aside className="flex min-w-0 flex-col gap-2 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:gap-4">
          {coachOn && !finished && <CoachPanel advice={advice} />}
          <section
            aria-label="Hand log"
            className="hidden flex-col gap-2.5 rounded-[14px] border border-line bg-surface p-5 lg:flex"
          >
            <h2 className="m-0 text-xl font-extrabold">This hand</h2>
            <div ref={logRef} className="flex max-h-[320px] flex-col overflow-y-auto">
              {log.map((line) => (
                <div
                  key={line.id}
                  className="flex gap-3 border-t border-line py-2 text-[15px] leading-snug"
                >
                  <span className="w-[72px] flex-none font-semibold text-ink-2">{line.street}</span>
                  <span>{line.text}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <div className="mt-auto lg:col-start-1 lg:row-start-2 lg:mt-0">
          {finished ? (
            <HandOver
              summary={handSummary(hand.events, names)}
              net={net}
              heroBroke={heroBroke}
              onNext={() => controller.nextHand()}
            />
          ) : (
            <ActionBar
              view={view}
              onAct={(action) => controller.act(action)}
              thinkingName={thinking === null ? null : names[thinking]}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function HandOver({
  summary,
  net,
  heroBroke,
  onNext,
}: {
  summary: string;
  net: number;
  heroBroke: boolean;
  onNext: () => void;
}) {
  useHotkey('N', onNext);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-center text-base font-bold" role="status">
        {summary}{' '}
        <span className={net >= 0 ? 'text-green' : 'text-red'}>{net > 0 ? `+${net}` : net}</span>
      </div>
      <button type="button" className={button('primary', 'min-h-14 w-full')} onClick={onNext}>
        {heroBroke ? 'Rebuy and deal' : 'Next hand'}
      </button>
    </div>
  );
}
