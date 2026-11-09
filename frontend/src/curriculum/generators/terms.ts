import type { Draft } from '@/curriculum/generators/hands';
import { type GenContext, optionSet, pick } from '@/curriculum/generators/shared';
import { GLOSSARY, type GlossaryTerm, getTerm } from '@/curriculum/glossary';
import { oneIn, type Rung, rungForTerm } from '@/curriculum/ladder';
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

/** Words where another word from the same group could fit the same sentence just as well. */
const NO_BLANK = new Set([
  ...GLOSSARY.filter((term) => term.category === 'position').map((term) => term.id),
  'flop',
  'turn',
  'river',
  'street',
  'small-blind',
  'big-blind',
  'bet',
  'three-bet',
  'pot',
  'split-pot',
  'chop',
  'three-of-a-kind',
  'straight',
  'flush',
  'full-house',
  'four-of-a-kind',
  'straight-flush',
  'royal-flush',
  'pair',
  'two-pair',
  'trips',
  'set',
  'quads',
]);

function blankSentence(term: GlossaryTerm): string | null {
  if (!term.example || NO_BLANK.has(term.id)) return null;
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

const flushRung = rungForTerm('flush') as Rung;
const straightRung = rungForTerm('straight') as Rung;

const CONCEPTS = {
  'five-of-a-kind': {
    prompt: 'Can you make five of a kind in Hold’em?',
    correct: 'No, there are only four of each rank',
    wrong: [
      'Yes, and it beats a royal flush',
      'Yes, but only with aces',
      'Yes, if the fifth card is on the river',
    ],
    explanation:
      'Each {rank} appears once per {suit}, so four is the limit. Five of the same suit is a {flush}, which is a different hand.',
    notes: {
      'Yes, and it beats a royal flush':
        'Some home games with wild cards have it, but Hold’em has no wild cards.',
      'Yes, but only with aces': 'There are only four aces, the same as every other rank.',
      'Yes, if the fifth card is on the river':
        'The river adds a card, but there is no fifth card of that rank in the deck.',
    },
  },
  'royal-is-straight-flush': {
    prompt: 'What is a {royal-flush|royal flush}?',
    correct: 'The highest possible straight flush',
    wrong: [
      'Any flush with an ace in it',
      'Any straight that ends in an ace',
      'A flush made of only face cards',
    ],
    explanation:
      'Ten to ace in one {suit} is simply the top {straight-flush|straight flush}, which is why nothing beats it.',
    notes: {
      'Any flush with an ace in it':
        'That is an ace-high flush. A royal flush also needs ten to ace in a row.',
      'Any straight that ends in an ace':
        'A straight to the ace can have mixed suits. A royal flush needs one suit.',
      'A flush made of only face cards':
        'A suit has only three face cards, so that could not make five.',
    },
  },
  'why-flush-beats-straight': {
    prompt: 'Why does a {flush} beat a {straight}?',
    correct: 'A flush is rarer',
    wrong: [
      'Suits are worth more than ranks',
      'A flush always has higher cards',
      'A flush uses more cards',
    ],
    explanation: `In five random cards, a {flush} comes up about ${oneIn(flushRung)} times and a {straight} about ${oneIn(straightRung)}. Every step up the ladder is a rarer hand.`,
    notes: {
      'Suits are worth more than ranks':
        'No suit is worth more than another. The order comes from how rare each hand is.',
      'A flush always has higher cards':
        'A seven-high flush still beats an ace-high straight, so the height of the cards is not why.',
      'A flush uses more cards': 'Both hands use all five cards.',
    },
  },
  'ace-low': {
    prompt: 'Is ace, two, three, four, five a {straight}?',
    correct: 'Yes, the ace plays low',
    wrong: [
      'No, an ace is always high',
      'Only if all five share a suit',
      'Only with a king as well',
    ],
    explanation: 'That straight is called a {wheel}. It is the lowest straight there is.',
    notes: {
      'No, an ace is always high':
        'An ace can be high or low in a straight, but it cannot be both at once.',
      'Only if all five share a suit':
        'A straight can have any mix of suits. All one suit would make it a straight flush.',
      'Only with a king as well':
        'A straight cannot wrap around the ace, so king and two never mix.',
    },
  },
  'matching-climb': {
    prompt: 'Going up the matching hands, what comes right after two pair (2 + 2)?',
    correct: 'Three of a kind (3)',
    wrong: ['Full house (3 + 2)', 'Four of a kind (4)', 'A pair (2)'],
    explanation: 'Matching ranks climb like this: 2, then 2 + 2, then 3, then 3 + 2, then 4.',
    notes: {
      'Full house (3 + 2)':
        'Among the matching hands, three of a kind comes first and then the full house.',
      'Four of a kind (4)': 'Four of a kind is the top of the matching hands.',
      'A pair (2)': 'A pair is the step below two pair.',
    },
  },
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
  const { options, answer } = optionSet(entry.correct, entry.wrong, rng);
  const notes = ('notes' in entry ? entry.notes : undefined) as Record<string, string> | undefined;
  return {
    kind: 'choice',
    prompt: entry.prompt,
    options,
    answer,
    explanation: entry.explanation,
    notes: notes && options.map((option) => notes[option]),
  };
}
