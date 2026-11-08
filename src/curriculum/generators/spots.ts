import type { Draft } from '@/curriculum/generators/hands';
import { pick, twoNames } from '@/curriculum/generators/shared';
import { coachAdvice, describeDraw, describeHolding } from '@/engine/coach/coach';
import { type Card, rankOf } from '@/engine/core/cards';
import { type Action, applyAction, type HandState, startHand } from '@/engine/core/hand';
import type { Rng } from '@/engine/core/rng';
import { viewFor } from '@/engine/core/view';
import { bestRank } from '@/engine/eval/evaluate';
import { categoryOf, HandCategory } from '@/engine/eval/rank';
import { holdemNoLimit } from '@/engine/variants/holdem';

export type SpotDecision = 'facing-bet' | 'checked-to';
export type SpotTheme = 'draw' | 'made' | 'weak';

export interface PlaySpotParams {
  decision?: SpotDecision;
  theme?: SpotTheme;
}

const HERO = 0;
const OPEN_TO = 30;
const MAX_TRIES = 500;
const ITERATIONS = 500;
/** Facing a bet, the chance of winning must be clearly above or below the price. */
const CLEAR_MARGIN = 0.1;
const BET_ABOVE = 0.62;
const CHECK_BELOW = 0.38;

const STREET_NAMES = ['pre-flop', 'flop', 'turn', 'river'];
const BET_SIZES = [0.5, 0.75, 1];

interface ScriptedHand {
  state: HandState;
  villainSeat: number;
  inPosition: boolean;
  bet: number;
}

/** Plays a real hand through the engine, up to the decision being asked about. */
function scriptHand(rng: Rng, street: number, facingBet: boolean): ScriptedHand {
  const inPosition = rng.nextInt(2) === 0;
  const buttonSeat = inPosition ? HERO : 4;
  const villainSeat = inPosition ? 5 : 4;

  let state = startHand({
    variantId: 'holdem-nl',
    seed: rng.nextUint32(),
    stakes: { smallBlind: 5, bigBlind: 10, ante: 0 },
    buttonSeat,
    seats: Array.from({ length: 6 }, (_, seat) => ({ seat, stack: 1000 })),
  });
  const act = (action: Action) => {
    state = applyAction(state, action).state;
  };

  while (state.street === 0) {
    if (state.toAct === villainSeat) act({ type: 'raise', to: OPEN_TO });
    else if (state.toAct === HERO) act({ type: 'call' });
    else act({ type: 'fold' });
  }
  while (state.street < street) act({ type: 'check' });

  let bet = 0;
  if (facingBet) {
    if (state.toAct === HERO) act({ type: 'check' });
    const pot = state.players.reduce((sum, player) => sum + player.totalBet, 0);
    bet = Math.max(10, Math.round((pot * pick(BET_SIZES, rng)) / 5) * 5);
    act({ type: 'raise', to: bet });
  } else if (state.toAct === villainSeat) {
    act({ type: 'check' });
  }

  return { state, villainSeat, inPosition, bet };
}

function usesHoleCards(hole: readonly Card[], board: readonly Card[]): boolean {
  return (
    rankOf(hole[0]) === rankOf(hole[1]) ||
    hole.some((c) => board.some((b) => rankOf(b) === rankOf(c)))
  );
}

function fitsTheme(
  theme: SpotTheme | undefined,
  hole: readonly Card[],
  board: readonly Card[],
): boolean {
  if (!theme) return true;
  const category = categoryOf(bestRank(holdemNoLimit, hole, board));
  const draw = describeDraw(holdemNoLimit, hole, board);

  switch (theme) {
    case 'draw':
      return draw !== null && category === HandCategory.HighCard;
    case 'made':
      return (
        category >= HandCategory.Pair &&
        (category >= HandCategory.Straight || usesHoleCards(hole, board))
      );
    case 'weak':
      return category === HandCategory.HighCard && draw === null;
  }
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function historyLines(
  script: ScriptedHand,
  villain: string,
  street: number,
  facingBet: boolean,
): string[] {
  const lines = [`${villain} raises to ${OPEN_TO} and you call.`];
  for (let earlier = 1; earlier < street; earlier++)
    lines.push(`You both check the ${STREET_NAMES[earlier]}.`);

  if (facingBet) lines.push(`${villain} bets ${script.bet}.`);
  else if (script.inPosition) lines.push(`${villain} checks to you.`);
  else lines.push('You act first.');
  return lines;
}

/**
 * A hand played out by the engine up to one decision. The answer comes from the same
 * calculation as the table coach, and only clear-cut spots are kept while they can be found.
 */
export function playSpot(params: PlaySpotParams, rng: Rng): Draft {
  for (let tries = 0; ; tries++) {
    const relaxed = tries >= MAX_TRIES;
    const facingBet = params.decision ? params.decision === 'facing-bet' : rng.nextInt(2) === 0;
    const street = 1 + rng.nextInt(params.theme === 'draw' ? 2 : 3);
    const script = scriptHand(rng, street, facingBet);
    const view = viewFor(script.state, HERO);
    const hole = view.players.find((player) => player.seat === HERO)?.hole ?? [];

    if (!relaxed && !fitsTheme(params.theme, hole, view.board)) continue;

    const advice = coachAdvice(view, rng, ITERATIONS);
    const needed = advice.needed;
    if (!relaxed) {
      // A weak-hand spot exists to teach letting go.
      if (params.theme === 'weak' && needed !== null && advice.equity >= needed) continue;
      if (needed !== null && Math.abs(advice.equity - needed) < CLEAR_MARGIN) continue;
      if (needed === null && advice.equity < BET_ABOVE && advice.equity > CHECK_BELOW) continue;
    }

    const holding = describeHolding(holdemNoLimit, hole, view.board);
    const chance = percent(advice.equity);
    const [villain] = twoNames(rng);
    const where = script.inPosition ? 'on the {button}' : 'in the {big-blind|big blind}';

    let options: string[];
    let answer: number;
    let verdict: string;
    if (needed !== null) {
      options = ['Fold', `Call ${advice.toCall}`];
      answer = advice.equity >= needed ? 1 : 0;
      verdict = `You need about ${percent(needed)} and have about ${chance}, so ${
        answer === 1 ? '{call|calling} makes money over time' : '{fold|folding} is better'
      }.`;
    } else {
      options = ['Check', 'Bet'];
      answer = advice.equity >= 0.5 ? 1 : 0;
      verdict =
        answer === 1
          ? `With about ${chance} you are likely ahead, so a {bet} builds the {pot}.`
          : `With about ${chance} you are probably behind, so {check|checking} is the safer play.`;
    }

    return {
      kind: 'spot',
      prompt: `You are ${where}. What do you do?`,
      hole,
      board: view.board,
      pot: view.pot,
      stack: view.players.find((player) => player.seat === HERO)?.stack ?? 0,
      history: historyLines(script, villain, street, facingBet),
      options,
      answer,
      needed,
      equity: advice.equity,
      explanation: `${holding} ${verdict}`,
    };
  }
}
