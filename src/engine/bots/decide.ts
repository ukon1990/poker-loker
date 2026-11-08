import { preflopPercentile } from '@/engine/bots/preflop';
import type { BotProfile } from '@/engine/bots/profile';
import { opponentRanges } from '@/engine/bots/ranges';
import type { TableTendencies } from '@/engine/bots/tendencies';
import { type Action, type LegalActions, seatsAfter } from '@/engine/core/hand';
import type { Rng } from '@/engine/core/rng';
import type { HandView, PublicPlayer } from '@/engine/core/view';
import { estimateEquity } from '@/engine/equity/equity';
import { getVariant } from '@/engine/variants';

export interface BotContext {
  tendencies?: TableTendencies;
  /** Lowers the simulation count, for tests and slow devices. */
  maxIterations?: number;
}

interface Option {
  action: Action;
  /** How good this looks to the bot. Comparable across its options. */
  value: number;
}

interface Spot {
  view: HandView;
  bot: BotProfile;
  legal: LegalActions;
  me: PublicPlayer;
  hole: readonly number[];
  opponents: PublicPlayer[];
  context: BotContext;
  rng: Rng;
  /** How much personal style counts. Skilled bots are less exploitable. */
  styleWeight: number;
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** A rough bell curve centred on 0, with a standard deviation near 1. */
function gaussian(rng: Rng): number {
  return (rng.nextFloat() + rng.nextFloat() + rng.nextFloat() + rng.nextFloat() - 2) * 1.73;
}

function raisesThisStreet(view: HandView): number {
  return view.events.filter(
    (event) =>
      event.type === 'action' &&
      event.street === view.street &&
      (event.action === 'raise' || event.action === 'bet'),
  ).length;
}

function isLastToAct(view: HandView, me: PublicPlayer): boolean {
  const order = seatsAfter(view.players, view.buttonSeat).filter((p) => p.status === 'active');
  return order.at(-1)?.seat === me.seat;
}

function playersStillToAct(view: HandView, me: PublicPlayer): number {
  const acted = new Set(
    view.events.flatMap((event) => (event.type === 'action' ? [event.seat] : [])),
  );
  return seatsAfter(view.players, me.seat).filter(
    (player) => player.seat !== me.seat && player.status === 'active' && !acted.has(player.seat),
  ).length;
}

/** Roughly how wide a sensible opening range is, by how many players act after this seat. */
function openingRange(view: HandView, me: PublicPlayer): number {
  if (view.players.length === 2) return 0.65;
  const behind = playersStillToAct(view, me);
  const byPlayersBehind = [0.38, 0.38, 0.42, 0.27, 0.2, 0.14, 0.12, 0.1, 0.09];
  return byPlayersBehind[behind] ?? 0.09;
}

function roundedTargets(
  view: HandView,
  raise: NonNullable<LegalActions['raise']>,
  targets: number[],
) {
  const unit = view.stakes.smallBlind;
  const rounded = targets.map((target) =>
    clamp(Math.round(target / unit) * unit, raise.min, raise.max),
  );
  return [...new Set(rounded)];
}

/** Before the flop: compares the hand with a range for the situation, as a chart would. */
function preflopOptions(spot: Spot): Option[] {
  const { view, bot, legal, me, hole, rng, styleWeight } = spot;
  const { skill, style } = bot;
  const { bigBlind } = view.stakes;

  const percentile = preflopPercentile(hole[0] as never, hole[1] as never);
  const perceived = clamp(percentile + gaussian(rng) * (0.01 + 0.15 * (1 - skill)), 0, 1);
  const raises = raisesThisStreet(view);
  const owed = legal.call ?? 0;

  const looseness = 1 + (style.looseness - 0.5) * 1.1 * styleWeight;
  const tooManyHands = lerp(1.9, 1, skill);
  const raiseLean = (style.aggression - 0.5) * 0.25 * styleWeight - (1 - skill) * 0.18;
  const scale = 3;

  let callTop: number;
  let raiseTop: number;

  if (raises === 0) {
    const open = Math.min(openingRange(view, me) * looseness, 0.9);
    raiseTop = open;
    callTop = open * lerp(1.5, 0.45, skill);
  } else if (raises === 1) {
    const sizeInBlinds = view.currentBet / bigBlind;
    const raiserRange = clamp(0.22 * Math.sqrt(3 / sizeInBlinds), 0.05, 0.4);
    const potPrice = owed > 0 ? clamp(view.pot / owed - 1.5, 0, 3) * 0.05 : 0;
    callTop = Math.min(raiserRange * lerp(2.2, 1.1, skill) * looseness + potPrice, 0.9);
    raiseTop = raiserRange * 0.25;
  } else {
    callTop = lerp(0.22, 0.05, skill);
    raiseTop = 0.025;
  }

  const options: Option[] = [];
  const tight = Math.min(callTop * tooManyHands, 0.95);

  if (legal.fold) options.push({ action: { type: 'fold' }, value: 0 });
  if (legal.check) options.push({ action: { type: 'check' }, value: 0.1 });
  if (legal.call !== null) {
    options.push({ action: { type: 'call' }, value: (tight - perceived) * scale });
  }

  if (legal.raise) {
    const base =
      raises === 0 ? [2.5 * bigBlind, 3 * bigBlind] : [(raises === 1 ? 3 : 2.3) * view.currentBet];
    const chosen = skill < 0.4 ? [base[rng.nextInt(base.length)]] : base;
    const stackCommitted = chosen.some((to) => to >= 0.4 * (me.stack + me.streetBet));
    const targets = stackCommitted ? [legal.raise.max] : chosen;

    for (const to of roundedTargets(view, legal.raise, targets)) {
      options.push({
        action: { type: 'raise', to },
        value: (raiseTop - perceived) * scale + raiseLean,
      });
    }
  }
  return options;
}

/** How often opponents are likely to fold to a bet of this size. */
function foldChance(extra: number, pot: number, spot: Spot, facingBet: boolean): number {
  const { opponents, bot, context } = spot;
  const ratio = extra / (pot + extra);
  let chance = clamp(0.05 + 0.55 * ratio, 0.05, 0.6);
  if (facingBet) chance *= 0.7;

  // Skilled bots use what they have seen. Folding often invites more bluffs.
  if (context.tendencies) {
    let faced = 0;
    let folded = 0;
    for (const opponent of opponents) {
      faced += context.tendencies[opponent.seat]?.faced ?? 0;
      folded += context.tendencies[opponent.seat]?.folded ?? 0;
    }
    if (faced > 0) {
      const confidence = Math.min(faced / 30, 1) * bot.skill;
      chance = lerp(chance, folded / faced, confidence);
    }
  }
  return chance ** Math.max(1, opponents.length);
}

function postflopTargets(
  spot: Spot,
  raise: NonNullable<LegalActions['raise']>,
  owed: number,
): number[] {
  const { view, bot, rng } = spot;
  const potAfterCall = view.pot + owed;
  const fractions = bot.skill < 0.4 ? [[0.33, 0.5, 1][rng.nextInt(3)]] : [0.5, 0.75, 1];
  const targets = fractions.map((fraction) => view.currentBet + fraction * potAfterCall);

  // Only commit the whole stack when it is already small next to the pot.
  if (raise.max <= view.currentBet + potAfterCall) targets.push(raise.max);
  return roundedTargets(view, raise, targets);
}

/** After the flop: estimates winning chances, then the value of each action. */
function postflopOptions(spot: Spot): Option[] {
  const { view, bot, legal, me, hole, context, rng, styleWeight } = spot;
  const { skill, style } = bot;
  const variant = getVariant(view.variantId);

  const iterations = Math.min(
    Math.round(60 + 340 * skill),
    context.maxIterations ?? Number.POSITIVE_INFINITY,
  );
  const equity = estimateEquity(
    variant,
    hole as never,
    view.board,
    opponentRanges(view, skill),
    iterations,
    rng,
  );

  const pot = Math.max(view.pot, view.stakes.bigBlind);
  const owed = legal.call ?? 0;
  const facingBet = owed > 0;

  // A bettor usually has something, and bigger bets mean stronger hands. Skilled bots adjust.
  const betPressure = facingBet ? skill * (0.12 + 0.3 * (owed / pot)) : 0;
  const misjudgement = gaussian(rng) * (0.02 + 0.13 * (1 - skill));
  const positionEdge = isLastToAct(view, me) ? 0.03 * skill : -0.02 * skill;
  const strength = clamp(equity * (1 - betPressure) + misjudgement + positionEdge, 0.01, 0.99);

  const totalChips = me.stack + me.totalBet;
  const raises = raisesThisStreet(view);
  const passive = (1 - skill) * 0.15;
  const raiseLean =
    ((style.aggression - 0.5) * 0.3 + (strength < 0.4 ? style.bluff * 0.25 : 0)) * styleWeight -
    passive;

  const options: Option[] = [];
  if (legal.fold) options.push({ action: { type: 'fold' }, value: 0 });
  if (legal.check) options.push({ action: { type: 'check' }, value: strength });
  if (legal.call !== null) {
    // Weaker bots underestimate what a call costs, so they call too much.
    const cost = legal.call * lerp(0.7, 1, skill);
    const risk = (legal.call / totalChips) ** 2 * (1 - strength) * 1.5;
    options.push({
      action: { type: 'call' },
      value: (strength * (pot + legal.call) - cost) / pot - risk,
    });
  }

  if (legal.raise) {
    // Callers hold better than average, and each raise this street shows more strength.
    const strengthIfCalled = strength - 0.05 - 0.1 * raises;

    for (const to of postflopTargets(spot, legal.raise, owed)) {
      const added = to - me.streetBet;
      const extra = to - view.currentBet;
      const fold = foldChance(extra, pot, spot, facingBet);
      const finalPot = pot + added + extra;
      const risk = (added / totalChips) ** 2 * (1 - strength) * 1.5;
      const value = fold * pot + (1 - fold) * (strengthIfCalled * finalPot - added);
      options.push({
        action: { type: 'raise', to },
        value: clamp(value / pot, -2, 2) + raiseLean - risk,
      });
    }
  }
  return options;
}

/** Chooses one option, with better options much more likely when `temperature` is low. */
function weightedChoice(options: readonly Option[], temperature: number, rng: Rng): Action {
  const best = Math.max(...options.map((option) => option.value));
  const weights = options.map((option) => Math.exp((option.value - best) / temperature));
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  let roll = rng.nextFloat() * total;
  for (let i = 0; i < options.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return options[i].action;
  }
  return options[options.length - 1].action;
}

/**
 * Decides a bot's action. It sees only `view`, so difficulty can never mean peeking at
 * cards. Skill changes how well it reads the spot; style changes what it prefers; and the
 * final choice is a weighted random draw, so it reacts to its cards without being predictable.
 */
export function decideBot(
  view: HandView,
  bot: BotProfile,
  rng: Rng,
  context: BotContext = {},
): Action {
  const { legal } = view;
  const me = view.players.find((player) => player.seat === view.seat);
  if (!legal || !me?.hole) throw new Error('This bot cannot act now');

  const spot: Spot = {
    view,
    bot,
    legal,
    me,
    hole: me.hole,
    opponents: view.players.filter((p) => p.seat !== view.seat && p.status !== 'folded'),
    context,
    rng,
    styleWeight: 1 - 0.4 * bot.skill,
  };

  const options = view.street === 0 ? preflopOptions(spot) : postflopOptions(spot);
  return weightedChoice(options, lerp(0.22, 0.04, bot.skill ** 0.8), rng);
}
