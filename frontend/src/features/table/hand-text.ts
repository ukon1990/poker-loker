import type { HandEvent } from '@/engine/core/hand';
import { cardName, describeHand } from '@/engine/eval/describe';
import { holdemNoLimit } from '@/engine/variants/holdem';

export const POSITION_TERMS: Record<string, string> = {
  BTN: 'button',
  SB: 'small-blind',
  BB: 'big-blind',
  UTG: 'under-the-gun',
  'UTG+1': 'under-the-gun',
  MP: 'middle-position',
  LJ: 'lojack',
  HJ: 'hijack',
  CO: 'cutoff',
};

const POSITION_ROLES: Record<string, (subject: string, verb: string) => string> = {
  BTN: (s, v) =>
    `${s} ${v} on the button, so ${s === 'You' ? 'you act' : 'they act'} last after the flop.`,
  SB: (s, v) => `${s} ${v} posting the small blind this hand.`,
  BB: (s, v) => `${s} ${v} posting the big blind this hand.`,
  UTG: (s, v) => `${s} ${v} first to act before the flop.`,
  CO: (s, v) => `${s} ${v} one seat before the button.`,
  HJ: (s, v) => `${s} ${v} two seats before the button.`,
};

export function positionContext(position: string, name: string): string {
  const verb = name === 'You' ? 'are' : 'is';
  return POSITION_ROLES[position]?.(name, verb) ?? `${name} ${verb} in this seat for this hand.`;
}

const ACTION_VERBS = {
  fold: 'folds',
  check: 'checks',
  call: 'calls',
  bet: 'bets',
  raise: 'raises to',
};
const ACTION_NOTES = { fold: 'Fold', check: 'Check', call: 'Call', bet: 'Bet', raise: 'Raise' };

function verb(name: string, action: keyof typeof ACTION_VERBS): string {
  if (name !== 'You') return ACTION_VERBS[action];
  return { fold: 'fold', check: 'check', call: 'call', bet: 'bet', raise: 'raise to' }[action];
}

/** A short label for what a seat did last this hand. */
export function lastAction(events: readonly HandEvent[], seat: number): string {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === 'action' && event.seat === seat) {
      return event.allIn ? 'All-in' : ACTION_NOTES[event.action];
    }
  }
  return '';
}

export interface LogLine {
  id: number;
  street: string;
  text: string;
}

/** The hand so far, in plain words. */
export function handLog(events: readonly HandEvent[], names: Record<number, string>): LogLine[] {
  const lines: Omit<LogLine, 'id'>[] = [];
  const streetLabel = (index: number) => holdemNoLimit.streets[index].label;

  for (const event of events) {
    switch (event.type) {
      case 'action': {
        const name = names[event.seat];
        const amount = event.action === 'bet' || event.action === 'raise' ? ` ${event.to}` : '';
        lines.push({
          street: streetLabel(event.street),
          text: `${name} ${verb(name, event.action)}${amount}${event.allIn ? ', all-in' : ''}.`,
        });
        break;
      }
      case 'street':
        lines.push({
          street: streetLabel(event.street),
          text: `${event.cards.map(cardName).join(', ')}.`,
        });
        break;
      case 'showdown':
        lines.push({
          street: 'Showdown',
          text: `${names[event.seat]} ${names[event.seat] === 'You' ? 'have' : 'has'} ${describeHand(event.rank)}.`,
        });
        break;
      case 'award':
        lines.push({
          street: 'Result',
          text: `${names[event.seat]} ${names[event.seat] === 'You' ? 'win' : 'wins'} ${event.amount}.`,
        });
        break;
    }
  }
  return lines.map((line, id) => ({ ...line, id }));
}

/** One sentence on who won the hand. */
export function handSummary(events: readonly HandEvent[], names: Record<number, string>): string {
  const totals = new Map<number, number>();
  for (const event of events) {
    if (event.type === 'award')
      totals.set(event.seat, (totals.get(event.seat) ?? 0) + event.amount);
  }
  const [seat, amount] = [...totals].sort((a, b) => b[1] - a[1])[0] ?? [0, 0];
  const name = names[seat];
  const shown = events.find((event) => event.type === 'showdown' && event.seat === seat);
  const hand = shown?.type === 'showdown' ? ` with ${describeHand(shown.rank)}` : '';
  const verbWin = name === 'You' ? 'win' : 'wins';
  // Without a showdown the total would include the winner's own uncalled bet.
  return shown ? `${name} ${verbWin} ${amount}${hand}.` : `${name} ${verbWin} the pot.`;
}
