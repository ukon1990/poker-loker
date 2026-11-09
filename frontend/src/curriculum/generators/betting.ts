import type { Draft } from '@/curriculum/generators/hands';
import { optionSet, pick, twoNames } from '@/curriculum/generators/shared';
import { applyAction, computePots, legalActions, seatsAfter, startHand } from '@/engine/core/hand';
import type { Rng } from '@/engine/core/rng';
import { positionNames } from '@/engine/core/table';

const STAKES = { smallBlind: 5, bigBlind: 10, ante: 0 };

function startTable(seatCount: number, buttonSeat: number) {
  return startHand({
    variantId: 'holdem-nl',
    seed: 1,
    stakes: STAKES,
    buttonSeat,
    seats: Array.from({ length: seatCount }, (_, seat) => ({ seat, stack: 1000 })),
  });
}

function step(rng: Rng, low: number, high: number, unit: number): number {
  return low + rng.nextInt(Math.floor((high - low) / unit) + 1) * unit;
}

function choice(
  prompt: string,
  correct: string,
  wrong: readonly string[],
  explanation: string,
  rng: Rng,
): Draft {
  return { kind: 'choice', prompt, ...optionSet(correct, wrong, rng), explanation };
}

function numbers(values: readonly number[]): string[] {
  return values.filter((value) => value > 0).map(String);
}

export type SeatRole =
  | 'small-blind'
  | 'big-blind'
  | 'first-preflop'
  | 'first-postflop'
  | 'last-postflop'
  | 'under-the-gun'
  | 'cutoff'
  | 'hijack';

/** Asks about a seat. The answer comes from dealing a real hand at that table. */
export function seatRole(params: { roles: SeatRole[] }, rng: Rng): Draft {
  const role = pick(params.roles, rng);
  const needsNamedSeat = role === 'cutoff' || role === 'hijack';
  const seatCount = needsNamedSeat ? 6 + rng.nextInt(4) : 3 + rng.nextInt(7);
  const buttonSeat = rng.nextInt(seatCount);
  const state = startTable(seatCount, buttonSeat);
  const forced = (kind: string) =>
    state.events.find((event) => event.type === 'forced' && event.kind === kind);
  const seatOf = (event: ReturnType<typeof forced>) => (event && 'seat' in event ? event.seat : 0);
  const names = positionNames(
    state.players.map((player) => player.seat),
    buttonSeat,
  );
  const named = (name: string) => [...names].find(([, value]) => value === name)?.[0] ?? 0;

  const questions: Record<SeatRole, { prompt: string; seat: number; explanation: string }> = {
    'small-blind': {
      prompt: 'Who posts the {small-blind|small blind}?',
      seat: seatOf(forced('small-blind')),
      explanation: 'The small blind sits directly left of the {button}.',
    },
    'big-blind': {
      prompt: 'Who posts the {big-blind|big blind}?',
      seat: seatOf(forced('big-blind')),
      explanation: 'The big blind sits two seats left of the {button}.',
    },
    'first-preflop': {
      prompt: 'Who acts first {pre-flop}?',
      seat: state.toAct ?? 0,
      explanation: 'The player directly left of the {big-blind|big blind} acts first pre-flop.',
    },
    'under-the-gun': {
      prompt: 'Which seat is {under-the-gun|under the gun}?',
      seat: state.toAct ?? 0,
      explanation: 'Under the gun is directly left of the {big-blind|big blind}.',
    },
    'first-postflop': {
      prompt: 'Who acts first after the {flop}?',
      seat: seatsAfter(state.players, buttonSeat)[0].seat,
      explanation: 'After the flop, the first player left of the {button} acts first.',
    },
    'last-postflop': {
      prompt: 'Who acts last after the {flop}?',
      seat: buttonSeat,
      explanation: 'The {button} acts last on every street after the flop.',
    },
    cutoff: {
      prompt: 'Which seat is the {cutoff}?',
      seat: named('CO'),
      explanation: 'The cutoff is directly to the right of the {button}.',
    },
    hijack: {
      prompt: 'Which seat is the {hijack}?',
      seat: named('HJ'),
      explanation: 'The hijack is two seats to the right of the {button}.',
    },
  };

  const question = questions[role];
  return {
    kind: 'seat',
    prompt: question.prompt,
    seatCount,
    buttonSeat,
    answerSeat: question.seat,
    explanation: question.explanation,
  };
}

export function potAfterCall(_params: object, rng: Rng): Draft {
  const [a, b] = twoNames(rng);
  const pot = step(rng, 20, 200, 10);
  const bet = step(rng, 10, 100, 10);
  const answer = pot + 2 * bet;
  return choice(
    `The {pot} is ${pot}. ${a} bets ${bet} and ${b} calls. How big is the pot now?`,
    String(answer),
    numbers([pot + bet, pot, answer + bet, answer + 10, answer - 10]),
    `${pot} + ${bet} + ${bet} = ${answer}. Each player’s chips go in the pot.`,
    rng,
  );
}

export function amountToCall(_params: object, rng: Rng): Draft {
  const [a] = twoNames(rng);
  const blind = pick([10, 20, 50], rng);
  const raiseTo = blind * (2 + rng.nextInt(5));
  const answer = raiseTo - blind;
  return choice(
    `You posted the {big-blind|big blind} of ${blind}. ${a} raises to ${raiseTo}. How much more do you need to {call}?`,
    String(answer),
    numbers([raiseTo, raiseTo + blind, blind, answer + blind]),
    `You already have ${blind} in, so you need ${raiseTo} − ${blind} = ${answer}.`,
    rng,
  );
}

export function actionName(_params: object, rng: Rng): Draft {
  const [a, b] = twoNames(rng);
  const size = step(rng, 20, 60, 10);
  const scenarios = [
    {
      text: `No one has bet yet. ${a} passes without putting in any chips.`,
      answer: 'Check',
      why: 'Passing with nothing to {call} is a {check}.',
    },
    {
      text: `No one has bet yet. ${a} puts in ${size}.`,
      answer: 'Bet',
      why: 'The first chips of a round are a {bet}.',
    },
    {
      text: `${a} bets ${size}. ${b} puts in ${size} as well.`,
      answer: 'Call',
      why: 'Matching the bet is a {call}.',
    },
    {
      text: `${a} bets ${size}. ${b} makes it ${size * 3}.`,
      answer: 'Raise',
      why: 'Increasing the bet is a {raise}.',
    },
    {
      text: `${a} bets ${size}. ${b} gives up their cards.`,
      answer: 'Fold',
      why: 'Giving up your hand is a {fold}.',
    },
  ];
  const scenario = pick(scenarios, rng);
  return choice(
    `${scenario.text} What is that called?`,
    scenario.answer,
    ['Check', 'Bet', 'Call', 'Raise', 'Fold'],
    scenario.why,
    rng,
  );
}

/** Asks what is not allowed. The rules engine decides. */
export function illegalAction(_params: object, rng: Rng): Draft {
  const [a] = twoNames(rng);
  const facingBet = rng.nextInt(2) === 0;
  let state = startTable(2, 0);
  state = applyAction(state, { type: 'call' }).state;
  state = applyAction(state, { type: 'check' }).state;

  const bet = step(rng, 20, 60, 10);
  if (facingBet) state = applyAction(state, { type: 'raise', to: bet }).state;
  const legal = legalActions(state);
  const answer = legal?.check ? 'Call' : 'Check';

  return choice(
    facingBet
      ? `${a} has bet ${bet}. Which of these can you not do?`
      : 'No one has bet yet. Which of these can you not do?',
    answer,
    ['Raise', legal?.check ? 'Check' : 'Call', ...(facingBet ? ['Fold'] : ['Bet'])],
    facingBet
      ? 'You cannot {check} when you are facing a bet.'
      : 'With no bet to match, there is nothing to {call}.',
    rng,
  );
}

export function minRaise(_params: object, rng: Rng): Draft {
  const [a] = twoNames(rng);
  const raiseTo = step(rng, 30, 100, 10);
  const state = applyAction(startTable(4, 0), { type: 'raise', to: raiseTo }).state;
  const answer = legalActions(state)?.raise?.min ?? 0;
  const increase = raiseTo - STAKES.bigBlind;
  return choice(
    `The blinds are 5 and 10. ${a} raises to ${raiseTo}. What is the smallest {re-raise} allowed?`,
    String(answer),
    numbers([raiseTo + 10, raiseTo + 5, raiseTo * 3, answer + 10, answer - 10]),
    `The raise added ${increase}. A {min-raise} must add at least that much again: ${raiseTo} + ${increase} = ${answer}.`,
    rng,
  );
}

export function betFraction(_params: object, rng: Rng): Draft {
  const pot = pick([60, 120, 180, 240, 300], rng);
  const fractions = [
    { name: 'half', value: 1 / 2 },
    { name: 'a third of', value: 1 / 3 },
    { name: 'two thirds of', value: 2 / 3 },
  ];
  const fraction = pick(fractions, rng);
  const answer = Math.round(pot * fraction.value);
  return choice(
    `The {pot} is ${pot}. How much is a bet of ${fraction.name} the pot?`,
    String(answer),
    numbers(fractions.map((entry) => Math.round(pot * entry.value)).concat(pot)),
    `${fraction.name[0].toUpperCase()}${fraction.name.slice(1)} ${pot} is ${answer}.`,
    rng,
  );
}

export function allInCall(_params: object, rng: Rng): Draft {
  const [a] = twoNames(rng);
  const stack = step(rng, 20, 90, 10);
  const bet = stack + step(rng, 10, 100, 10);
  return choice(
    `You have ${stack} left. ${a} bets ${bet}. How much do you need to call {all-in}?`,
    String(stack),
    numbers([bet, bet - stack, stack * 2]),
    `You can only ever bet the chips you have, so calling costs your last ${stack}.`,
    rng,
  );
}

function sidePotSpot(rng: Rng) {
  const [a, b] = twoNames(rng);
  const c = a === 'You' ? 'Otto' : 'You';
  const short = step(rng, 20, 100, 10);
  const big = short + step(rng, 20, 200, 10);
  const pots = computePots([
    { seat: 0, status: 'all-in', totalBet: short },
    { seat: 1, status: 'active', totalBet: big },
    { seat: 2, status: 'active', totalBet: big },
  ]);
  return { a, b, c, short, big, main: pots[0].amount, side: pots[1].amount };
}

export function sidePot(params: { ask: 'main' | 'side' | 'who' }, rng: Rng): Draft {
  const spot = sidePotSpot(rng);
  const setup = `${spot.a} is {all-in} for ${spot.short}. ${spot.b} and ${spot.c} each put in ${spot.big}.`;

  if (params.ask === 'who') {
    return choice(
      `${setup} Who can win the {side-pot|side pot}?`,
      `${spot.b} and ${spot.c}`,
      ['All three players', `Only ${spot.a}`, `${spot.a} and ${spot.b}`],
      `${spot.a} could not match the extra bets, so only ${spot.b} and ${spot.c} can win them.`,
      rng,
    );
  }

  if (params.ask === 'main') {
    return choice(
      `${setup} How big is the {main-pot|main pot}?`,
      String(spot.main),
      numbers([spot.main + spot.side, spot.side, spot.short * 2, spot.big * 3]),
      `Each player matches ${spot.short}: 3 × ${spot.short} = ${spot.main}.`,
      rng,
    );
  }

  return choice(
    `${setup} How big is the {side-pot|side pot}?`,
    String(spot.side),
    numbers([spot.main, spot.big * 2, spot.main + spot.side, spot.side + spot.short]),
    `${spot.b} and ${spot.c} each add ${spot.big - spot.short} beyond ${spot.short}: 2 × ${spot.big - spot.short} = ${spot.side}.`,
    rng,
  );
}
