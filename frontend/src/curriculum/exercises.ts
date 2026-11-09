import type { Card } from '@/engine/core/cards';
import type { HandRank } from '@/engine/eval/rank';

interface ExerciseBase {
  /** Skills this practises. Answers feed spaced review. */
  skills: string[];
}

export interface NewWordExercise extends ExerciseBase {
  kind: 'new-word';
  termId: string;
}

export interface LadderExercise extends ExerciseBase {
  kind: 'ladder';
  prompt: string;
  intro: string;
  /** Glossary ids of the hands this lesson is about. */
  highlight: string[];
}

/** A comparison solved in front of the learner, step by step. */
export interface WorkedExercise extends ExerciseBase {
  kind: 'worked';
  prompt: string;
  board?: Card[];
  hands: { label: string; cards: Card[]; result: string }[];
  /** Cards to outline, when the example is about choosing cards. */
  best?: Card[];
  steps: string[];
}

export interface MatchExercise extends ExerciseBase {
  kind: 'match';
  terms: { termId: string; term: string; meaning: string }[];
  /** Display order of the meanings, as indexes into `terms`. */
  meaningOrder: number[];
}

export interface ChoiceExercise extends ExerciseBase {
  kind: 'choice';
  prompt: string;
  /** A row of cards to study, such as a single hand. */
  cards?: Card[];
  hole?: Card[];
  board?: Card[];
  options: string[];
  answer: number;
  explanation: string;
  /** What is wrong with each option, for a learner who picks it. Parallel to `options`. */
  notes?: (string | undefined)[];
}

export interface CompareExercise extends ExerciseBase {
  kind: 'compare';
  prompt: string;
  board: Card[];
  hands: { label: string; cards: Card[]; result: string }[];
  /** Offer a "split the pot" answer. */
  offerSplit: boolean;
  /** Show each hand's name before answering, so only the comparison is left to do. */
  showNames?: boolean;
  /** Index into `hands`, or `hands.length` when the pot is split. */
  answer: number;
  explanation: string;
  /** What to do differently after picking each answer. Indexed like `answer`. */
  notes?: (string | undefined)[];
}

export interface BestFiveExercise extends ExerciseBase {
  kind: 'best-five';
  prompt: string;
  hole: Card[];
  board: Card[];
  /** Any five cards reaching this rank are correct. */
  bestRank: HandRank;
  explanation: string;
}

export interface OrderExercise extends ExerciseBase {
  kind: 'order';
  prompt: string;
  /** Without cards, the names themselves are what gets ordered. */
  hands: { cards?: Card[]; result: string }[];
  /** Indexes into `hands`, strongest first. */
  order: number[];
  explanation: string;
}

export interface SeatExercise extends ExerciseBase {
  kind: 'seat';
  prompt: string;
  seatCount: number;
  buttonSeat: number;
  answerSeat: number;
  explanation: string;
}

export interface SpotExercise extends ExerciseBase {
  kind: 'spot';
  prompt: string;
  hole: Card[];
  board: Card[];
  pot: number;
  stack: number;
  /** What happened before this decision, in plain words. */
  history: string[];
  options: string[];
  answer: number;
  /** The share of the pot a call must win. Null when there is nothing to call. */
  needed: number | null;
  equity: number;
  explanation: string;
}

export type Exercise =
  | NewWordExercise
  | LadderExercise
  | WorkedExercise
  | MatchExercise
  | ChoiceExercise
  | CompareExercise
  | BestFiveExercise
  | OrderExercise
  | SeatExercise
  | SpotExercise;

export type ExerciseKind = Exercise['kind'];
