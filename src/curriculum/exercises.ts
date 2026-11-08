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
}

export interface CompareExercise extends ExerciseBase {
  kind: 'compare';
  prompt: string;
  board: Card[];
  hands: { label: string; cards: Card[]; result: string }[];
  /** Offer a "split the pot" answer. */
  offerSplit: boolean;
  /** Index into `hands`, or `hands.length` when the pot is split. */
  answer: number;
  explanation: string;
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
  hands: { cards: Card[]; result: string }[];
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
  | MatchExercise
  | ChoiceExercise
  | CompareExercise
  | BestFiveExercise
  | OrderExercise
  | SeatExercise
  | SpotExercise;

export type ExerciseKind = Exercise['kind'];
