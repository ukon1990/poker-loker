import type { Card } from '@/engine/core/cards';
import {
  type HandEvent,
  type HandResult,
  type HandState,
  type LegalActions,
  legalActions,
  type PlayerStatus,
  type Stakes,
} from '@/engine/core/hand';
import type { VariantId } from '@/engine/variants/types';

export interface PublicPlayer {
  seat: number;
  stack: number;
  status: PlayerStatus;
  streetBet: number;
  totalBet: number;
  /** Null unless these cards are visible to the viewer. */
  hole: Card[] | null;
}

/** What one seat can see. Bots and the coach only ever receive this. */
export interface HandView {
  variantId: VariantId;
  seat: number;
  stakes: Stakes;
  buttonSeat: number;
  players: PublicPlayer[];
  board: Card[];
  street: number;
  currentBet: number;
  lastRaiseSize: number;
  pot: number;
  toAct: number | null;
  /** Legal actions, when it is this seat's turn. */
  legal: LegalActions | null;
  events: HandEvent[];
  result: HandResult | null;
}

/** Removes everything this seat must not know, including the deck and the seed. */
export function viewFor(state: HandState, seat: number): HandView {
  const shownAtShowdown = new Set(
    state.events.flatMap((event) => (event.type === 'showdown' ? [event.seat] : [])),
  );

  return {
    variantId: state.variantId,
    seat,
    stakes: state.stakes,
    buttonSeat: state.buttonSeat,
    players: state.players.map((player) => ({
      seat: player.seat,
      stack: player.stack,
      status: player.status,
      streetBet: player.streetBet,
      totalBet: player.totalBet,
      hole: player.seat === seat || shownAtShowdown.has(player.seat) ? player.hole : null,
    })),
    board: state.board,
    street: state.street,
    currentBet: state.currentBet,
    lastRaiseSize: state.lastRaiseSize,
    pot: state.players.reduce((sum, player) => sum + player.totalBet, 0),
    toAct: state.toAct,
    legal: state.toAct === seat ? legalActions(state) : null,
    events: state.events,
    result: state.result,
  };
}
