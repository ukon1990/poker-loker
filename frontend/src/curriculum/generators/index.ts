import type { Exercise } from '@/curriculum/exercises';
import {
  actionName,
  allInCall,
  amountToCall,
  betFraction,
  illegalAction,
  minRaise,
  potAfterCall,
  seatRole,
  sidePot,
} from '@/curriculum/generators/betting';
import {
  bestFive,
  boardCompare,
  compareHands,
  compareSame,
  type Draft,
  deckFact,
  higherCard,
  ladderNext,
  ladderStep,
  lookAlike,
  nameHand,
  nameSeven,
  orderHands,
  orderNames,
  workedBestFive,
  workedCompare,
  workedKicker,
} from '@/curriculum/generators/hands';
import type { GenContext } from '@/curriculum/generators/shared';
import { playSpot } from '@/curriculum/generators/spots';
import {
  bankrollRule,
  callOrFold,
  countOuts,
  flopSuits,
  openOrFold,
  potOdds,
  ruleOfTwoAndFour,
  strongerStart,
  valueOrBluff,
  wetOrDry,
} from '@/curriculum/generators/strategy';
import {
  completeSentence,
  concept,
  matchTerms,
  newWord,
  streetFact,
  termFromMeaning,
  termMeaning,
} from '@/curriculum/generators/terms';
import { createRng, type Rng } from '@/engine/core/rng';

// biome-ignore lint/suspicious/noExplicitAny: each generator declares its own parameters.
type Generator = (params: any, rng: Rng, context: GenContext) => Draft;

const GENERATORS = {
  'new-word': newWord,
  'match-terms': matchTerms,
  'term-meaning': termMeaning,
  'term-from-meaning': termFromMeaning,
  'complete-sentence': completeSentence,
  'street-fact': streetFact,
  concept,
  'higher-card': higherCard,
  'deck-fact': deckFact,
  ladder: ladderStep,
  'name-hand': nameHand,
  'look-alike': lookAlike,
  'worked-compare': workedCompare,
  'worked-best-five': workedBestFive,
  'worked-kicker': workedKicker,
  'name-seven': nameSeven,
  'compare-hands': compareHands,
  'compare-same': compareSame,
  'board-compare': boardCompare,
  'best-five': bestFive,
  'order-hands': orderHands,
  'order-names': orderNames,
  'ladder-next': ladderNext,
  'seat-role': seatRole,
  'pot-after-call': potAfterCall,
  'amount-to-call': amountToCall,
  'action-name': actionName,
  'illegal-action': illegalAction,
  'min-raise': minRaise,
  'bet-fraction': betFraction,
  'all-in-call': allInCall,
  'side-pot': sidePot,
  'stronger-start': strongerStart,
  'open-or-fold': openOrFold,
  'count-outs': countOuts,
  'rule-of-two-and-four': ruleOfTwoAndFour,
  'pot-odds': potOdds,
  'call-or-fold': callOrFold,
  'flop-suits': flopSuits,
  'wet-or-dry': wetOrDry,
  'value-or-bluff': valueOrBluff,
  'bankroll-rule': bankrollRule,
  'play-spot': playSpot,
} satisfies Record<string, Generator>;

export type GeneratorId = keyof typeof GENERATORS;

export interface StepSpec<K extends GeneratorId = GeneratorId> {
  gen: K;
  params: Parameters<(typeof GENERATORS)[K]>[0];
  skills: string[];
}

export function generateExercise(spec: StepSpec, seed: number, context: GenContext): Exercise {
  const generator = GENERATORS[spec.gen] as Generator;
  const draft = generator(spec.params, createRng(seed), context);
  return { ...draft, skills: [...new Set([...spec.skills, ...(draft.skills ?? [])])] } as Exercise;
}
