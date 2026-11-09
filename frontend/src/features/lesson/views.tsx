import { type ComponentType, useEffect, useMemo, useState } from 'react';
import type {
  BestFiveExercise,
  ChoiceExercise,
  CompareExercise,
  Exercise,
  ExerciseKind,
  LadderExercise,
  MatchExercise,
  NewWordExercise,
  OrderExercise,
  SeatExercise,
  SpotExercise,
  WorkedExercise,
} from '@/curriculum/exercises';
import { getTerm } from '@/curriculum/glossary';
import { bestFiveMistake, orderMistake, rungForTerm } from '@/curriculum/ladder';
import { type Card, cards as parseCards } from '@/engine/core/cards';
import { combinations } from '@/engine/core/combinations';
import { rankFive } from '@/engine/eval/rank';
import { type SeatMark, SeatRing } from '@/features/lesson/SeatRing';
import { HandLadder, RungNote } from '@/features/terms/HandLadder';
import { RichText, TermLink } from '@/features/terms/RichText';
import { type CardSize, EmptyCardSlot, PlayingCard } from '@/ui/PlayingCard';

export interface ExerciseViewProps<E extends Exercise> {
  exercise: E;
  /** True once the answer has been submitted and should be shown as right or wrong. */
  checked: boolean;
  /** Reports the current answer: right, wrong, or not finished yet, and what a wrong one missed. */
  onAnswer: (correct: boolean | null, note?: string, missedSkills?: readonly string[]) => void;
}

interface ExerciseViewEntry<E extends Exercise> {
  View: ComponentType<ExerciseViewProps<E>>;
  /** The view confirms completion itself, so no Check step or feedback is needed. */
  selfChecked?: boolean;
  actionLabel?: string;
}

function Prompt({ text }: { text: string }) {
  return (
    <h1 className="m-0 text-[28px] leading-tight font-extrabold">
      <RichText text={text} />
    </h1>
  );
}

/** Five cards only just fit a phone, so they spread out instead of wrapping. */
function rowClasses(count: number): string {
  return count === 5
    ? 'flex flex-wrap justify-between gap-y-1.5 sm:justify-start sm:gap-x-1.5'
    : 'flex flex-wrap gap-1.5';
}

function CardRow({
  label,
  cards,
  size = 'md',
}: {
  label: string;
  cards: readonly Card[];
  size?: CardSize;
}) {
  return (
    <section aria-label={label}>
      <div className="mb-2 text-[13px] font-semibold text-ink-2">{label}</div>
      <div className={rowClasses(cards.length)}>
        {cards.map((card) => (
          <PlayingCard key={card} card={card} size={size} />
        ))}
      </div>
    </section>
  );
}

function optionClasses(selected: boolean, isRight: boolean, checked: boolean): string {
  if (checked && isRight) return 'border-green bg-felt-tint text-felt-ink';
  if (checked && selected) return 'border-red bg-red-tint text-red-ink';
  return selected ? 'border-ink bg-surface text-ink' : 'border-line bg-surface text-ink';
}

function ChoiceView({ exercise, checked, onAnswer }: ExerciseViewProps<ChoiceExercise>) {
  const [picked, setPicked] = useState<number | null>(null);
  const hasOpponent = exercise.cards && exercise.hole;

  return (
    <>
      <Prompt text={exercise.prompt} />
      {exercise.hole && (
        <CardRow label="Your cards" cards={exercise.hole} size={hasOpponent ? 'sm' : 'md'} />
      )}
      {exercise.cards && (
        <CardRow
          label={hasOpponent ? 'Opponent’s cards' : 'Cards'}
          cards={exercise.cards}
          size={hasOpponent ? 'sm' : 'md'}
        />
      )}
      {exercise.board && (
        <CardRow label="Board" cards={exercise.board} size={hasOpponent ? 'sm' : 'md'} />
      )}
      <div className="flex flex-col gap-2">
        {exercise.options.map((option, index) => (
          <button
            key={option}
            type="button"
            disabled={checked}
            aria-pressed={picked === index}
            onClick={() => {
              setPicked(index);
              onAnswer(index === exercise.answer, exercise.notes?.[index]);
            }}
            className={`min-h-[52px] rounded-[12px] border-2 px-4 py-2 text-left text-base font-semibold first-letter:uppercase ${optionClasses(picked === index, index === exercise.answer, checked)}`}
          >
            {option}
          </button>
        ))}
      </div>
    </>
  );
}

function CompareView({ exercise, checked, onAnswer }: ExerciseViewProps<CompareExercise>) {
  const [picked, setPicked] = useState<number | null>(null);
  const splitIndex = exercise.hands.length;
  const stacked = exercise.hands[0].cards.length > 2;
  const showName = (result: string) => (checked || exercise.showNames ? result : '');

  const pick = (index: number) => {
    setPicked(index);
    onAnswer(index === exercise.answer, exercise.notes?.[index]);
  };

  return (
    <>
      <Prompt text={exercise.prompt} />
      {exercise.board.length > 0 && <CardRow label="Board" cards={exercise.board} />}
      {exercise.hands.length > 2 ? (
        // Rows line the hands up, so a single different card is easy to spot.
        <div className="flex flex-col gap-2">
          {exercise.hands.map((hand, index) => (
            <button
              key={hand.label}
              type="button"
              disabled={checked}
              aria-pressed={picked === index}
              onClick={() => pick(index)}
              className={`flex items-center gap-3 rounded-[14px] border-2 p-2.5 ${optionClasses(picked === index, index === exercise.answer, checked)}`}
            >
              <span className="w-4 flex-none text-[15px] font-bold">{hand.label}</span>
              <span className="flex flex-col gap-1">
                <span className="flex gap-1">
                  {hand.cards.map((card) => (
                    <PlayingCard key={card} card={card} size="xs" />
                  ))}
                </span>
                <span className="min-h-[18px] text-left text-[13px] font-bold">
                  {showName(hand.result)}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className={`grid gap-3 ${stacked ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {exercise.hands.map((hand, index) => (
            <button
              key={hand.label}
              type="button"
              disabled={checked}
              aria-pressed={picked === index}
              onClick={() => pick(index)}
              className={`flex flex-col items-center gap-2.5 rounded-[14px] border-2 px-2 py-3.5 ${optionClasses(picked === index, index === exercise.answer, checked)}`}
            >
              <span className="text-[15px] font-bold">{hand.label}</span>
              <span className="flex gap-1.5">
                {hand.cards.map((card) => (
                  <PlayingCard key={card} card={card} size={stacked ? 'sm' : 'md'} />
                ))}
              </span>
              <span className="min-h-[18px] text-[13px] font-bold">{showName(hand.result)}</span>
            </button>
          ))}
        </div>
      )}
      {exercise.offerSplit && (
        <button
          type="button"
          disabled={checked}
          aria-pressed={picked === splitIndex}
          onClick={() => pick(splitIndex)}
          className={`min-h-[52px] rounded-[12px] border-2 text-base font-bold ${optionClasses(picked === splitIndex, exercise.answer === splitIndex, checked)}`}
        >
          Split the pot
        </button>
      )}
    </>
  );
}

function BestFiveView({ exercise, checked, onAnswer }: ExerciseViewProps<BestFiveExercise>) {
  const [selected, setSelected] = useState<Card[]>([]);

  const toggle = (card: Card) => {
    const next = selected.includes(card)
      ? selected.filter((value) => value !== card)
      : selected.length < 5
        ? [...selected, card]
        : selected;
    setSelected(next);
    if (next.length < 5) {
      onAnswer(null);
      return;
    }
    const rank = rankFive(next);
    onAnswer(rank === exercise.bestRank, bestFiveMistake(rank, exercise.bestRank));
  };

  // After checking, show a correct five so a wrong answer can be learned from.
  const answer = useMemo(() => {
    const all = [...exercise.hole, ...exercise.board];
    return combinations(all, 5).find((hand) => rankFive(hand) === exercise.bestRank) ?? [];
  }, [exercise]);

  const ringFor = (card: Card) => {
    if (checked) return answer.includes(card) ? ('green' as const) : undefined;
    return selected.includes(card) ? ('ink' as const) : undefined;
  };

  const row = (label: string, cards: readonly Card[]) => (
    <section aria-label={label}>
      <div className="mb-2 text-[13px] font-semibold text-ink-2">{label}</div>
      <div className={rowClasses(cards.length)}>
        {cards.map((card) => (
          <button
            key={card}
            type="button"
            disabled={checked}
            aria-pressed={selected.includes(card)}
            onClick={() => toggle(card)}
            className={`rounded-lg border-0 bg-transparent p-0 transition-transform ${selected.includes(card) ? '-translate-y-1.5' : ''}`}
          >
            <PlayingCard card={card} size="md" ring={ringFor(card)} />
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <>
      <Prompt text={exercise.prompt} />
      {row('Board', exercise.board)}
      {row('Your cards', exercise.hole)}
      <div className="text-[13px] font-semibold text-ink-2">{selected.length} of 5 chosen</div>
    </>
  );
}

function OrderView({ exercise, checked, onAnswer }: ExerciseViewProps<OrderExercise>) {
  const [order, setOrder] = useState<number[]>([]);

  const toggle = (index: number) => {
    const next = order.includes(index) ? order.filter((v) => v !== index) : [...order, index];
    setOrder(next);
    if (next.length < exercise.hands.length) {
      onAnswer(null);
      return;
    }
    const right = next.every((value, i) => value === exercise.order[i]);
    onAnswer(right, right ? undefined : orderMistake(next.map((i) => exercise.hands[i].result)));
  };

  return (
    <>
      <Prompt text={exercise.prompt} />
      <div className="flex flex-col gap-2">
        {exercise.hands.map((hand, index) => {
          const position = order.indexOf(index);
          const isRight = checked && exercise.order[position] === index;
          return (
            <button
              key={hand.cards?.[0] ?? hand.result}
              type="button"
              disabled={checked}
              aria-pressed={position >= 0}
              onClick={() => toggle(index)}
              className={`flex items-center gap-3 rounded-[14px] border-2 p-2.5 ${optionClasses(position >= 0, isRight, checked)}`}
            >
              <span className="flex size-8 flex-none items-center justify-center rounded-full bg-ground font-card text-lg font-bold text-ink">
                {position >= 0 ? position + 1 : ''}
              </span>
              {hand.cards ? (
                <span className="flex flex-wrap gap-1">
                  {hand.cards.map((card) => (
                    <PlayingCard key={card} card={card} size="xs" />
                  ))}
                </span>
              ) : (
                <span className="text-base font-bold">{hand.result}</span>
              )}
              {checked && hand.cards && (
                <span className="ml-auto text-[13px] font-bold">{hand.result}</span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

function SeatView({ exercise, checked, onAnswer }: ExerciseViewProps<SeatExercise>) {
  const [picked, setPicked] = useState<number | null>(null);
  const marks: Record<number, SeatMark> = {};
  if (picked !== null) marks[picked] = checked ? 'wrong' : 'picked';
  if (checked) marks[exercise.answerSeat] = 'right';

  return (
    <>
      <Prompt text={exercise.prompt} />
      <SeatRing
        seatCount={exercise.seatCount}
        buttonSeat={exercise.buttonSeat}
        marks={marks}
        disabled={checked}
        onPick={(seat) => {
          setPicked(seat);
          onAnswer(seat === exercise.answerSeat);
        }}
      />
    </>
  );
}

function SpotView({ exercise, checked, onAnswer }: ExerciseViewProps<SpotExercise>) {
  const [picked, setPicked] = useState<number | null>(null);
  const slots = Array.from({ length: 5 }, (_, index) => index);

  return (
    <>
      <Prompt text={exercise.prompt} />

      <section
        aria-label="Table"
        className="flex flex-col gap-2 rounded-3xl bg-felt px-3.5 py-3 text-on-felt"
      >
        <div className="text-center text-base font-bold">
          <TermLink id="pot">Pot</TermLink> {exercise.pot}
        </div>
        <div className="flex justify-between sm:justify-center sm:gap-1.5">
          {slots.map((index) => {
            const card = exercise.board[index];
            return card === undefined ? (
              <EmptyCardSlot key={`empty-${index}`} size="sm" />
            ) : (
              <PlayingCard key={card} card={card} size="sm" />
            );
          })}
        </div>
        <div className="flex justify-center gap-1.5">
          {exercise.hole.map((card, index) => (
            <PlayingCard key={card} card={card} size="sm" tilt={index === 0 ? -2 : 2} />
          ))}
        </div>
        <div className="text-center text-sm font-bold">You have {exercise.stack} left</div>
      </section>

      <section aria-label="What happened">
        <div className="mb-1 text-[13px] font-semibold text-ink-2">What happened</div>
        {exercise.history.map((line) => (
          <p key={line} className="m-0 text-[15px] leading-snug">
            {line}
          </p>
        ))}
      </section>

      <div className="grid grid-cols-2 gap-2">
        {exercise.options.map((option, index) => (
          <button
            key={option}
            type="button"
            disabled={checked}
            aria-pressed={picked === index}
            onClick={() => {
              setPicked(index);
              onAnswer(index === exercise.answer);
            }}
            className={`min-h-[52px] rounded-[12px] border-2 px-4 py-2 text-base font-bold ${optionClasses(picked === index, index === exercise.answer, checked)}`}
          >
            {option}
          </button>
        ))}
      </div>
    </>
  );
}

function MatchView({ exercise, onAnswer }: ExerciseViewProps<MatchExercise>) {
  const [term, setTerm] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const [missed, setMissed] = useState<readonly string[]>([]);

  const pickMeaning = (index: number) => {
    if (term === null) return;
    if (term === index) {
      const next = [...matched, index];
      setMatched(next);
      setTerm(null);
      setWrong(null);
      if (next.length === exercise.terms.length) onAnswer(true, undefined, missed);
    } else {
      const skill = `term:${exercise.terms[term].termId}`;
      setMissed((list) => (list.includes(skill) ? list : [...list, skill]));
      setWrong(index);
    }
  };

  const classes = (isMatched: boolean, isSelected: boolean, isWrong = false) =>
    isMatched
      ? 'border-green bg-felt-tint text-felt-ink'
      : isWrong
        ? 'border-red bg-red-tint text-red-ink'
        : isSelected
          ? 'border-ink bg-surface text-ink'
          : 'border-line bg-surface text-ink';

  return (
    <>
      <Prompt text="Match each word to its meaning" />
      <div className="grid grid-cols-[124px_minmax(0,1fr)] gap-3">
        {exercise.terms.map((entry, row) => {
          const meaningIndex = exercise.meaningOrder[row];
          const meaning = exercise.terms[meaningIndex];
          return [
            <button
              key={entry.termId}
              type="button"
              disabled={matched.includes(row)}
              aria-pressed={term === row}
              onClick={() => {
                setTerm(row);
                setWrong(null);
              }}
              className={`min-h-[84px] rounded-[12px] border-2 p-2 text-lg font-bold ${classes(matched.includes(row), term === row)}`}
            >
              {entry.term}
            </button>,
            <button
              key={meaning.meaning}
              type="button"
              disabled={matched.includes(meaningIndex)}
              onClick={() => pickMeaning(meaningIndex)}
              className={`min-h-[84px] rounded-[12px] border-2 px-3.5 py-2 text-left text-base leading-snug font-medium ${classes(matched.includes(meaningIndex), false, wrong === meaningIndex)}`}
            >
              {meaning.meaning}
            </button>,
          ];
        })}
      </div>
    </>
  );
}

const WHEEL = parseCards('Ah 2c 3d 4s 5h');

const TERM_BOARD_SIZE: Partial<Record<string, number>> = {
  flop: 3,
  turn: 4,
  river: 5,
  board: 5,
  'community-cards': 5,
};

/** Seat offset clockwise from the button, in a six-handed illustration. */
const TERM_SEATS: Partial<Record<string, number>> = {
  button: 0,
  'small-blind': 1,
  'big-blind': 2,
  'under-the-gun': 3,
  hijack: 4,
  cutoff: 5,
};

const SAMPLE_BOARD = parseCards('Ks 9d 3d Jc 5h');

function TermVisual({ termId }: { termId: string }) {
  // First sight of a hand is tidy, so the pattern is easy to see.
  const hand = termId === 'wheel' ? WHEEL : rungForTerm(termId)?.sample;

  if (hand) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {hand.map((card) => (
          <PlayingCard key={card} card={card} size="sm" />
        ))}
      </div>
    );
  }

  const boardSize = TERM_BOARD_SIZE[termId];
  if (boardSize !== undefined) {
    return (
      <section
        aria-label="Example board"
        className="flex justify-between rounded-3xl bg-felt px-3.5 py-5"
      >
        {SAMPLE_BOARD.map((card, index) =>
          index < boardSize ? (
            <PlayingCard key={card} card={card} size="sm" />
          ) : (
            <EmptyCardSlot key={card} size="sm" />
          ),
        )}
      </section>
    );
  }

  const seat = TERM_SEATS[termId];
  if (seat !== undefined) {
    return <SeatRing seatCount={6} buttonSeat={0} marks={{ [seat]: 'highlight' }} />;
  }
  return null;
}

function NewWordView({ exercise, onAnswer }: ExerciseViewProps<NewWordExercise>) {
  const term = getTerm(exercise.termId);

  useEffect(() => onAnswer(true), [onAnswer]);

  return (
    <>
      <div>
        <div className="text-sm font-bold text-red">New word</div>
        <h1 className="m-0 mt-1 font-card text-[56px] leading-none font-bold">{term.term}</h1>
        {term.abbreviation && (
          <div className="mt-1 text-[15px] font-bold text-ink-2">{term.abbreviation}</div>
        )}
      </div>
      <p className="m-0 text-xl leading-snug">
        <RichText text={term.long} />
      </p>
      <TermVisual termId={term.id} />
      <RungNote termId={term.id} />
      {term.example && (
        <div className="rounded-[14px] border border-line bg-surface px-4 py-3.5">
          <div className="mb-1 text-[13px] font-semibold text-ink-2">
            At the table you might hear
          </div>
          <div className="text-base leading-snug">“{term.example}”</div>
        </div>
      )}
    </>
  );
}

function LadderView({ exercise, onAnswer }: ExerciseViewProps<LadderExercise>) {
  useEffect(() => onAnswer(true), [onAnswer]);

  return (
    <>
      <Prompt text={exercise.prompt} />
      <p className="m-0 text-lg leading-snug">{exercise.intro}</p>
      <HandLadder highlight={exercise.highlight} />
    </>
  );
}

function WorkedView({ exercise, onAnswer }: ExerciseViewProps<WorkedExercise>) {
  useEffect(() => onAnswer(true), [onAnswer]);
  const ringFor = (card: Card) => (exercise.best?.includes(card) ? ('green' as const) : undefined);

  return (
    <>
      <div>
        <div className="text-sm font-bold text-red">Watch how it’s done</div>
        <h1 className="m-0 mt-1 text-[28px] leading-tight font-extrabold">{exercise.prompt}</h1>
      </div>
      <section aria-label="Worked example" className="flex flex-col gap-4">
        {exercise.board && (
          <div>
            <div className="mb-1.5 text-[15px] font-bold">Board</div>
            <div className={rowClasses(exercise.board.length)}>
              {exercise.board.map((card) => (
                <PlayingCard key={card} card={card} size="sm" ring={ringFor(card)} />
              ))}
            </div>
          </div>
        )}
        {exercise.hands.map((hand) => (
          <div key={hand.label}>
            <div className="mb-1.5 flex items-baseline justify-between text-[15px] font-bold">
              <span>{hand.label}</span>
              <span>{hand.result}</span>
            </div>
            <div className={rowClasses(hand.cards.length)}>
              {hand.cards.map((card) => (
                <PlayingCard key={card} card={card} size="sm" ring={ringFor(card)} />
              ))}
            </div>
          </div>
        ))}
        <ol className="m-0 flex list-decimal flex-col gap-2 pl-6 text-base leading-snug">
          {exercise.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </>
  );
}

type ViewRegistry = { [K in ExerciseKind]: ExerciseViewEntry<Extract<Exercise, { kind: K }>> };

/** Add an entry here to add an exercise type. The lesson player needs no changes. */
const VIEWS: ViewRegistry = {
  'new-word': { View: NewWordView, selfChecked: true, actionLabel: 'Got it' },
  ladder: { View: LadderView, selfChecked: true, actionLabel: 'Got it' },
  worked: { View: WorkedView, selfChecked: true, actionLabel: 'Got it' },
  match: { View: MatchView, selfChecked: true, actionLabel: 'Continue' },
  choice: { View: ChoiceView },
  compare: { View: CompareView },
  'best-five': { View: BestFiveView },
  order: { View: OrderView },
  seat: { View: SeatView },
  spot: { View: SpotView },
};

export function viewFor(exercise: Exercise): ExerciseViewEntry<Exercise> {
  return VIEWS[exercise.kind] as unknown as ExerciseViewEntry<Exercise>;
}
