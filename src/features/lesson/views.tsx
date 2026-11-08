import { type ComponentType, useEffect, useMemo, useState } from 'react';
import type {
  BestFiveExercise,
  ChoiceExercise,
  CompareExercise,
  Exercise,
  ExerciseKind,
  MatchExercise,
  NewWordExercise,
  OrderExercise,
  SeatExercise,
} from '@/curriculum/exercises';
import { buildHand } from '@/curriculum/generators/shared';
import { getTerm } from '@/curriculum/glossary';
import { type Card, cards as parseCards } from '@/engine/core/cards';
import { createRng, deriveSeed } from '@/engine/core/rng';
import { HandCategory, rankFive } from '@/engine/eval/rank';
import { type SeatMark, SeatRing } from '@/features/lesson/SeatRing';
import { RichText } from '@/features/terms/RichText';
import { EmptyCardSlot, PlayingCard } from '@/ui/PlayingCard';

export interface ExerciseViewProps<E extends Exercise> {
  exercise: E;
  /** True once the answer has been submitted and should be shown as right or wrong. */
  checked: boolean;
  /** Reports the current answer: right, wrong, or not finished yet. */
  onAnswer: (correct: boolean | null) => void;
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

function CardRow({ label, cards }: { label: string; cards: readonly Card[] }) {
  return (
    <section aria-label={label}>
      <div className="mb-2 text-[13px] font-semibold text-ink-2">{label}</div>
      <div className="flex flex-wrap justify-between gap-y-1.5 sm:justify-start sm:gap-x-1.5">
        {cards.map((card) => (
          <PlayingCard key={card} card={card} size="md" />
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
      {exercise.hole && <CardRow label="Your cards" cards={exercise.hole} />}
      {exercise.cards && (
        <CardRow label={hasOpponent ? 'Opponent’s cards' : 'Cards'} cards={exercise.cards} />
      )}
      {exercise.board && <CardRow label="Board" cards={exercise.board} />}
      <div className="flex flex-col gap-2">
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

  const pick = (index: number) => {
    setPicked(index);
    onAnswer(index === exercise.answer);
  };

  return (
    <>
      <Prompt text={exercise.prompt} />
      {exercise.board.length > 0 && <CardRow label="Board" cards={exercise.board} />}
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
            <span className="min-h-[18px] text-[13px] font-bold">{checked ? hand.result : ''}</span>
          </button>
        ))}
      </div>
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
    onAnswer(next.length === 5 ? rankFive(next) === exercise.bestRank : null);
  };

  const row = (label: string, cards: readonly Card[]) => (
    <section aria-label={label}>
      <div className="mb-2 text-[13px] font-semibold text-ink-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {cards.map((card) => (
          <button
            key={card}
            type="button"
            disabled={checked}
            aria-pressed={selected.includes(card)}
            onClick={() => toggle(card)}
            className={`rounded-lg border-0 bg-transparent p-0 transition-transform ${selected.includes(card) ? '-translate-y-1.5' : ''}`}
          >
            <PlayingCard card={card} size="md" ring={selected.includes(card) ? 'ink' : undefined} />
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
    onAnswer(
      next.length === exercise.hands.length
        ? next.every((value, i) => value === exercise.order[i])
        : null,
    );
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
              key={hand.cards[0]}
              type="button"
              disabled={checked}
              aria-pressed={position >= 0}
              onClick={() => toggle(index)}
              className={`flex items-center gap-3 rounded-[14px] border-2 p-2.5 ${optionClasses(position >= 0, isRight, checked)}`}
            >
              <span className="flex size-8 flex-none items-center justify-center rounded-full bg-ground font-card text-lg font-bold text-ink">
                {position >= 0 ? position + 1 : ''}
              </span>
              <span className="flex flex-wrap gap-1">
                {hand.cards.map((card) => (
                  <PlayingCard key={card} card={card} size="xs" />
                ))}
              </span>
              {checked && <span className="ml-auto text-[13px] font-bold">{hand.result}</span>}
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

function MatchView({ exercise, onAnswer }: ExerciseViewProps<MatchExercise>) {
  const [term, setTerm] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);

  const pickMeaning = (index: number) => {
    if (term === null) return;
    if (term === index) {
      const next = [...matched, index];
      setMatched(next);
      setTerm(null);
      setWrong(null);
      if (next.length === exercise.terms.length) onAnswer(true);
    } else {
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
      <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3">
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

const TERM_HANDS: Partial<Record<string, HandCategory>> = {
  'high-card': HandCategory.HighCard,
  pair: HandCategory.Pair,
  'two-pair': HandCategory.TwoPair,
  'three-of-a-kind': HandCategory.ThreeOfAKind,
  trips: HandCategory.ThreeOfAKind,
  straight: HandCategory.Straight,
  flush: HandCategory.Flush,
  'full-house': HandCategory.FullHouse,
  'four-of-a-kind': HandCategory.FourOfAKind,
  quads: HandCategory.FourOfAKind,
  'straight-flush': HandCategory.StraightFlush,
};

const TERM_FIXED_HANDS: Partial<Record<string, string>> = {
  'royal-flush': 'Ts Js Qs Ks As',
  wheel: 'Ah 2c 3d 4s 5h',
};

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

function termSeed(termId: string): number {
  return deriveSeed(...[...termId].map((char) => char.charCodeAt(0)));
}

function TermVisual({ termId }: { termId: string }) {
  const hand = useMemo(() => {
    const fixed = TERM_FIXED_HANDS[termId];
    if (fixed) return parseCards(fixed);
    const category = TERM_HANDS[termId];
    return category === undefined ? null : buildHand(category, createRng(termSeed(termId)));
  }, [termId]);

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

type ViewRegistry = { [K in ExerciseKind]: ExerciseViewEntry<Extract<Exercise, { kind: K }>> };

/** Add an entry here to add an exercise type. The lesson player needs no changes. */
const VIEWS: ViewRegistry = {
  'new-word': { View: NewWordView, selfChecked: true, actionLabel: 'Got it' },
  match: { View: MatchView, selfChecked: true, actionLabel: 'Continue' },
  choice: { View: ChoiceView },
  compare: { View: CompareView },
  'best-five': { View: BestFiveView },
  order: { View: OrderView },
  seat: { View: SeatView },
};

export function viewFor(exercise: Exercise): ExerciseViewEntry<Exercise> {
  return VIEWS[exercise.kind] as unknown as ExerciseViewEntry<Exercise>;
}
