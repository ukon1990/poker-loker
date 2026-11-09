import type { Draft } from '@/curriculum/generators/hands';
import { type GenContext, optionSet, pick } from '@/curriculum/generators/shared';
import { GLOSSARY, type GlossaryTerm, getTerm } from '@/curriculum/glossary';
import { shuffle } from '@/engine/core/deck';
import type { Rng } from '@/engine/core/rng';
import { holdemNoLimit } from '@/engine/variants/holdem';

const MATCH_SIZE = 4;

export function newWord(params: { termId: string }): Draft {
  return { kind: 'new-word', termId: params.termId };
}

/** This lesson's words first, then earlier ones, so the newest get the most practice. */
function practicePool(
  params: { termIds?: string[] },
  context: GenContext,
  rng: Rng,
): GlossaryTerm[] {
  if (params.termIds) return params.termIds.map(getTerm);
  const ids = [...shuffle(context.lessonTerms, rng), ...shuffle(context.knownTerms, rng)];
  return [...new Set(ids)].map(getTerm);
}

export function matchTerms(params: { termIds?: string[] }, rng: Rng, context: GenContext): Draft {
  const chosen = practicePool(params, context, rng).slice(0, MATCH_SIZE);
  const terms = chosen.map((term) => ({ termId: term.id, term: term.term, meaning: term.short }));
  return {
    kind: 'match',
    terms,
    meaningOrder: shuffle(
      terms.map((_, index) => index),
      rng,
    ),
    skills: chosen.map((term) => `term:${term.id}`),
  };
}

function distractors(target: GlossaryTerm, field: (term: GlossaryTerm) => string): string[] {
  const sameCategory = GLOSSARY.filter((t) => t.category === target.category && t.id !== target.id);
  return sameCategory.map(field);
}

export function termMeaning(params: { termId?: string }, rng: Rng, context: GenContext): Draft {
  const term = params.termId ? getTerm(params.termId) : practicePool({}, context, rng)[0];
  const { options, answer } = optionSet(
    term.short,
    distractors(term, (t) => t.short),
    rng,
  );
  return {
    kind: 'choice',
    prompt: `What does “${term.term}” mean?`,
    options,
    answer,
    explanation: term.long,
    skills: [`term:${term.id}`],
  };
}

export function termFromMeaning(params: { termId?: string }, rng: Rng, context: GenContext): Draft {
  const term = params.termId ? getTerm(params.termId) : practicePool({}, context, rng)[0];
  const { options, answer } = optionSet(
    term.term,
    distractors(term, (t) => t.term),
    rng,
  );
  return {
    kind: 'choice',
    prompt: `Which word means this? “${term.short}”`,
    options,
    answer,
    explanation: term.long,
    skills: [`term:${term.id}`],
  };
}

function blankSentence(term: GlossaryTerm): string | null {
  if (!term.example) return null;
  const pattern = new RegExp(`\\b${term.term}\\b`, 'i');
  return pattern.test(term.example) ? term.example.replace(pattern, '____') : null;
}

export function completeSentence(_params: object, rng: Rng, context: GenContext): Draft {
  const pool = practicePool({}, context, rng);
  const term = pool.find((candidate) => blankSentence(candidate) !== null) ?? pool[0];
  const sentence = blankSentence(term);
  if (!sentence) return termMeaning({ termId: term.id }, rng, context);

  const { options, answer } = optionSet(
    term.term,
    distractors(term, (t) => t.term),
    rng,
  );
  return {
    kind: 'choice',
    prompt: `Which word completes this? “${sentence}”`,
    options,
    answer,
    explanation: `“${term.example}” ${term.short}`,
    skills: [`term:${term.id}`],
  };
}

/** Questions answered from the variant's own definition of its streets. */
export function streetFact(_params: object, rng: Rng): Draft {
  const { streets, holeCards } = holdemNoLimit;
  const totals: number[] = [];
  streets.reduce((sum, street) => {
    totals.push(sum + street.boardCards);
    return sum + street.boardCards;
  }, 0);

  const index = 1 + rng.nextInt(streets.length - 1);
  const street = streets[index];
  const count = totals[index];
  const facts = [
    {
      prompt: `How many {community-cards|community cards} are showing after the {${street.id}}?`,
      correct: String(count),
      wrong: ['1', '2', '3', '4', '5', '6'],
      explanation: `After the ${street.label.toLowerCase()} there are ${count} cards on the {board}.`,
    },
    {
      prompt: `Which {street} comes right after the ${streets[index - 1].label.toLowerCase()}?`,
      correct: street.label,
      wrong: streets.map((entry) => entry.label),
      explanation: `The order is ${streets.map((entry) => entry.label).join(', ')}.`,
    },
    {
      prompt: 'How many {hole-cards|hole cards} does each player get?',
      correct: String(holeCards),
      wrong: ['1', '3', '4', '5'],
      explanation: `In Hold’em each player gets ${holeCards}.`,
    },
  ];
  const fact = pick(facts, rng);
  return {
    kind: 'choice',
    prompt: fact.prompt,
    ...optionSet(fact.correct, fact.wrong, rng),
    explanation: fact.explanation,
  };
}

const CONCEPTS = {
  'why-position': {
    prompt: 'Why is acting last an advantage?',
    correct: 'You see what others do before you decide',
    wrong: ['You get to bet more chips', 'You get better cards', 'You pay smaller blinds'],
    explanation: 'Acting last gives you more information. That is why {position} matters.',
  },
  'what-beats-suit': {
    prompt: 'Two flushes tie on every card rank. Which suit wins?',
    correct: 'Neither, the pot is split',
    wrong: ['Spades', 'Hearts', 'Whichever has the highest suit'],
    explanation: 'No {suit} ranks above another in poker.',
  },
  'cbet-who': {
    prompt: 'Who can make a {continuation-bet|continuation bet}?',
    correct: 'The player who raised before the flop',
    wrong: ['The player in the big blind', 'Anyone who called', 'Only the button'],
    explanation: 'It continues the aggression shown {pre-flop}.',
  },
  'cbet-board': {
    prompt: 'On which {flop} does a {continuation-bet|continuation bet} usually work best?',
    correct: 'A dry flop that missed most hands',
    wrong: [
      'A wet flop with many draws',
      'A flop full of cards opponents like',
      'It works the same on every flop',
    ],
    explanation: 'On a {dry-board|dry board}, fewer opponents have anything worth continuing with.',
  },
  'semi-bluff': {
    prompt: 'What makes a {semi-bluff} different from a pure {bluff}?',
    correct: 'You can still improve to the best hand',
    wrong: ['It is a smaller bet', 'You always have the best hand', 'It only works on the river'],
    explanation: 'With a {draw}, you can win when they fold or when you hit.',
  },
  variance: {
    prompt: 'You play well and still lose five sessions in a row. What is the likely cause?',
    correct: 'Normal variance',
    wrong: ['The bots are cheating', 'Your good decisions were actually bad', 'The deck is broken'],
    explanation: 'Luck swings results in the short term. Judge decisions rather than results.',
  },
  'tilt-sign': {
    prompt: 'Which of these is a sign of {tilt}?',
    correct: 'Playing more hands to win your chips back',
    wrong: ['Folding a weak hand', 'Taking a short break', 'Reviewing a hand afterwards'],
    explanation: 'Chasing losses is the classic sign that emotion has taken over.',
  },
  'tilt-response': {
    prompt: 'You just lost a big pot and feel angry. What is the best move?',
    correct: 'Take a break before the next hand',
    wrong: [
      'Raise the next hand to win it back',
      'Move to a bigger game',
      'Call everything for a while',
    ],
    explanation: 'A short break costs nothing. {tilt|Tilt} can cost a lot.',
  },
  'bankroll-separate': {
    prompt: 'What should a {bankroll} be?',
    correct: 'Money set aside only for poker',
    wrong: ['Your rent money', 'Whatever is in your account', 'Money you borrowed'],
    explanation: 'Only play with money you can afford to lose.',
  },
  'good-habit': {
    prompt: 'Which habit helps you improve fastest?',
    correct: 'Reviewing your decisions after playing',
    wrong: ['Only remembering the big wins', 'Playing every hand for practice', 'Blaming bad luck'],
    explanation: 'Reviewing hands turns experience into learning.',
  },
  'implied-odds': {
    prompt: 'When do {implied-odds|implied odds} matter most?',
    correct: 'When you can win a lot more if you hit',
    wrong: [
      'When the pot is already huge and no chips are left',
      'On the river',
      'When you have the best hand',
    ],
    explanation: 'They count the chips you can still win on later streets.',
  },
} as const;

export type ConceptId = keyof typeof CONCEPTS;

/** A true concept question. The facts are authored, and the option order is shuffled. */
export function concept(params: { id: ConceptId }, rng: Rng): Draft {
  const entry = CONCEPTS[params.id];
  return {
    kind: 'choice',
    prompt: entry.prompt,
    ...optionSet(entry.correct, entry.wrong, rng),
    explanation: entry.explanation,
  };
}
