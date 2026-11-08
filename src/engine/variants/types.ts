import type { Card } from '@/engine/core/cards';
import type { DeckSpec } from '@/engine/core/deck';
import type { HandRank } from '@/engine/eval/rank';

export type VariantId = 'holdem-nl';

export interface StreetSpec {
  id: string;
  label: string;
  /** Community cards dealt when this street begins. */
  boardCards: number;
}

export interface ForcedBetSpec {
  blinds: boolean;
  antes: boolean;
}

export type BettingStructure = 'no-limit' | 'pot-limit' | 'fixed-limit';

export interface PotContender {
  seat: number;
  hole: readonly Card[];
  rank: HandRank;
}

export interface PotAward {
  seat: number;
  amount: number;
}

/**
 * Everything that differs between poker variants. The betting engine and UI read this
 * and never special-case a particular game. See docs/engine.md.
 */
export interface VariantDefinition {
  id: VariantId;
  name: string;
  deck: DeckSpec;
  holeCards: number;
  streets: readonly StreetSpec[];
  forcedBets: ForcedBetSpec;
  structure: BettingStructure;
  /** Every five-card hand a player may legally make. */
  candidateHands(hole: readonly Card[], board: readonly Card[]): Card[][];
  rankHand(cards: readonly Card[]): HandRank;
  /**
   * Splits a pot. `contenders` must be in seat order starting left of the button,
   * because odd chips go to the earliest winners.
   */
  awardPot(amount: number, contenders: readonly PotContender[], board: readonly Card[]): PotAward[];
}
