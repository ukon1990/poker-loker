# Curriculum and learning system

## Structure

Course (one per variant) → Unit → Lesson → Exercises, stored as typed data in `frontend/src/curriculum`.

## Hold'em course

1. Cards and hand rankings
2. Reading the board: best five of seven, kickers, ties
3. Betting rounds, blinds, actions, all-ins, side pots
4. Position
5. Starting hands
6. Outs and pot odds
7. Post-flop basics: board texture, value bets, bluffs
8. Bankroll and tilt

## Terminology

Poker has its own language, and a beginner cannot follow advice until they can read it. Terminology is therefore taught on purpose in every unit, not picked up by accident.

**How a word is taught**

1. **Introduced when it is needed.** A lesson lists the terms it introduces. Each new term gets a "New word" card at that point in the lesson: the word, a plain definition, a picture from the game, and an example sentence.
2. **Practised straight away.** Exercises in the same lesson make the player use the word: match it to its meaning, spot it on a table, or complete a sentence.
3. **Reviewed over time.** Each term is also a skill (`term:flop`), so it follows the same spaced review as everything else.
4. **Always one tap away.** Anywhere a term appears, in lessons, coach text, or at the table, it has a dotted underline and opens a short definition sheet. The Glossary screen lists and searches every term.

Looking up a term at the table adds it to review, because needing to look it up is a sign it has not stuck yet.

**Rules for course content**

- Lesson and coach text marks terms explicitly, so tap targets are never guessed by matching strings.
- A lesson may only use a term that has been introduced by that point, or that it links to the glossary.
- A curriculum test enforces both rules: every marked term must exist in the glossary, and must be introduced no later than its first use.

**Data shape** (`frontend/src/curriculum/glossary/`)

```ts
interface GlossaryTerm {
  id: string; // 'button'
  term: string; // 'Button'
  abbreviation?: string; // 'BTN'
  aliases: string[]; // ['dealer']
  category: 'cards' | 'flow' | 'betting' | 'position' | 'maths';
  short: string; // One line, for lists
  long: string; // For the definition sheet
  example?: string;
  variantIds: VariantId[] | 'all'; // "Flop" does not apply to every variant
}
```

**Starter vocabulary**

| Category           | Terms                                                                                                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cards and hands    | hole cards, community cards, board, kicker, high card, pair, two pair, three of a kind, trips, set, straight, wheel, flush, full house, four of a kind, quads, straight flush, royal flush, the nuts |
| Game flow          | hand, pre-flop, flop, turn, river, street, showdown, pot, side pot, split pot, chop                                                                                                                  |
| Betting            | small blind, big blind, ante, check, bet, call, raise, re-raise, three-bet, fold, all-in, min-raise, limp, stack, buy-in, no-limit                                                                   |
| Positions          | button, under the gun, hijack, cutoff, early, middle and late position, in position, out of position                                                                                                 |
| Maths and strategy | outs, equity, pot odds, implied odds, range, draw, continuation bet, value bet, bluff, semi-bluff, board texture, tilt, bankroll                                                                     |

## Teaching the hand rankings

Recognising a hand and knowing where it ranks are separate skills, so the course teaches both on purpose. The ranking lives in one place, `frontend/src/curriculum/ladder.ts`: ten rungs in three groups (small hands, hands where all five cards work, monsters). The engine has nine categories, because to it a royal flush is a straight flush, and `handName` gives the name players know.

- **Teach one group at a time.** The ladder's three groups are the lessons: small hands, strong hands, monsters. Lesson 1-5 ranks them all together.
- **See the whole ladder first.** Lessons 1-2 to 1-4 open with the ladder, with that lesson's hands picked out, and partway through 1-5 it returns with the idea that rebuilds it. Each rung says what makes the hand. Any hand's definition sheet and the Glossary have it one tap away.
- **Recall before seeing.** Lessons 1-3 and 1-4 ask from memory about the rungs taught so far before showing the ladder again. Ordering by name builds from 4 to 6 to all 10. The first question after a new hand is always about that hand.
- **Worked examples, then fading.** A worked comparison shows the steps. The next comparison shows the hand names, and the one after is unaided. The first question on a new hand deals its cards in order, and later ones are shuffled.
- **Say why.** Every step up the ladder is rarer in five random cards. Five-card comparisons give that reason. Board exercises from Unit 2 on leave it out, so the help fades. The claim holds for five cards only: with seven, a pair is more common than no pair.
- **Practise the mix-ups.** Each lesson step names the close call it deals, so every neighbouring pair appears in Unit 1 and straight against flush and flush against full house appear twice. Close calls keep the most alike of several deals. Look-alikes put four hands on one screen, lined up, each a card or two apart. Each hand also has its own review record, so review returns to the hands that slip.
- **Recall the order from memory.** Next-step questions and ordering hand names use no cards, so they test the ranking and not reading the cards.
- **Feedback on the actual mistake.** A wrong answer also says what the learner picked and why it was wrong, or names the first pair put the wrong way round, or says what to do next time.

The rarity figures are checked by a test that enumerates all 2,598,960 five-card hands.

## Exercise types

Each type is an entry in a renderer registry, so adding one does not touch the lesson player.

- New word card
- Hand ladder overview
- Worked comparison
- Match terms to meanings
- Spot the term on a table (tap the flop, the button, the big blind)
- Complete the sentence
- Multiple choice
- Pick the winning hand, including close calls and two hands of the same type
- Pick the look-alike from four hands side by side
- Tap the best five cards
- Order the hands, by their cards or by name
- Name the next step on the ladder
- Count the outs
- Calculate pot odds
- Fold, call, or raise at a given position
- Play this spot: the engine plays a real hand up to one decision, and the coach's calculation decides the answer

## Generated exercises

**Lessons define what to teach, never which cards appear.** A lesson step names a generator and its parameters, for example "compare two hands, where the winner has three of a kind and the loser has two pair". Every play-through deals new cards from a new seed.

**Answers and options are calculated, never typed in.** The generator deals the cards, asks the same evaluator the simulation uses who wins, and builds the options, the correct answer, and the explanation from that result. A wrong answer key is impossible by construction.

- Each generator retries until the deal fits its parameters, and relaxes the constraints if a rare combination does not come up. The result is still calculated, so it is always correct.
- Rare hands, such as four of a kind, are constructed directly rather than waited for.
- A question answered wrongly returns at the end of the lesson with the **same** cards, because the seed is kept. Review sessions and repeat play-throughs get new cards.
- Numbers are calculated too: pot sizes, pot odds, outs, minimum raises, side pots, and who is the big blind.
- Term exercises draw from the words introduced so far, with distractors chosen at random.
- Only true concept questions, such as how to handle tilt, have authored answers. Their option order is still shuffled.

A test runs every generator across thousands of seeds and independently re-checks each answer with the evaluator.

## Mastery and review

Every exercise is tagged with skills. Each skill has a Leitner box per variant. A correct answer on a due skill moves it up and lengthens the review interval, and a wrong answer moves it down. Correct answers before the due day are extra practice and do not move it, so several in one sitting do not count as several spaced reviews. A "Review" session draws from what is due, and asks only questions from lessons already finished, across all the hands taught, without the help they first came with, and without asking the same question twice while others remain. Wrong pairs in a matching exercise count against those words.

## Motivation

XP per exercise, a daily XP goal, a streak based on local calendar days, and locked or unlocked nodes on the path. There are no hearts or lives.
