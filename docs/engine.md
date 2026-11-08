# Poker engine

`src/engine` is pure TypeScript with no React or DOM dependency.

## Implemented so far

- **Cards** are integers (`rank * 4 + suit`) for fast evaluation. `card('As')`, `cards('As Kd')`, and `formatCard` convert to and from readable text.
- **RNG** is seeded and its state is a single integer, so it can be serialized with a hand. Every shuffle is reproducible from a seed.
- **Hand ranking**: `rankFive` returns a single number, and a larger number is a better hand. Correctness is tested by enumerating all 2,598,960 five-card hands against the known category counts.
- **`evaluateHand`** finds a player's best hand for any variant through the variant's hooks.

## Variant model

Each variant is a `VariantDefinition`: data plus hooks. The engine and UI do not special-case Hold'em.

| Field            | Purpose                                    | Example of what it allows          |
| ---------------- | ------------------------------------------ | ---------------------------------- |
| `deck`           | Which cards are in play                    | 36-card short deck                 |
| `holeCards`      | Cards dealt to each player                 | 4 for Omaha                        |
| `streets`        | Street names and board cards dealt         | Any community-card game            |
| `forcedBets`     | Whether blinds and/or antes apply          | Ante games                         |
| `structure`      | Betting limits                             | Pot-limit, fixed-limit             |
| `candidateHands` | Which 5-card combinations a player may use | Omaha's "exactly two hole cards"   |
| `rankHand`       | Ranks 5 cards                              | Short deck's flush-over-full-house |
| `awardPot`       | Splits a pot among contenders              | Hi-lo split                        |

To add a variant: write a definition in `src/engine/variants/`, add it to the registry, and add a course.

**Known limit:** the model covers community-card games. Stud (per-player up cards) and draw (card exchange) would need extra street types.

## Hand rules

- `applyAction(state, action) → { state, events }`: a pure reducer over serializable state, so a hand can be saved, resumed, and replayed from its seed and action log.
- `viewFor(state, seat)` removes hidden information. Bots and coach receive only this view, so they cannot cheat.
- Rules: side pots, heads-up blind order, minimum raises, short all-ins that do not reopen betting, odd chips in split pots.
- Equity calculation in a Web Worker so the UI stays smooth.

## Bots and difficulty

**Fairness rules. These do not bend at any difficulty.**

- The deck is shuffled from the hand's seed before anything else happens. Difficulty cannot change which cards are dealt.
- Bots only receive `viewFor(state, seat)`. They never see other players' cards, the deck, or the seed.
- Difficulty changes only how well a bot decides.

**Each decision is a weighted random choice.** `decideBot` works in four steps:

1. Judge the cards it actually holds. Before the flop it compares them with a range for the situation, as a chart would. After the flop it runs a Monte Carlo simulation against estimated opponent ranges.
2. Estimate the value of every legal action: fold, check, call, and several raise sizes.
3. Apply the bot's personal style.
4. Turn those values into weights and draw one at random (softmax).

A strong hand makes aggressive actions likely but never certain, so a bot's play reacts to its cards and to the betting without being predictable.

**A bot has two independent traits.**

| Trait       | What it means                                       | Set                                       |
| ----------- | --------------------------------------------------- | ----------------------------------------- |
| Style       | Personality: looseness, aggression, bluff frequency | One persona per bot                       |
| Skill (0–1) | How good its decisions are                          | Before the match, stored with the session |

**What skill changes:**

| Low skill                                    | High skill                                       |
| -------------------------------------------- | ------------------------------------------------ |
| Misjudges its hand strength by a wide margin | Judges it accurately                             |
| Assumes opponents could hold anything        | Narrows opponents' ranges from how they bet      |
| Underweights the price of calling            | Respects pot odds                                |
| Few bet sizes                                | Picks from several sizes                         |
| Often picks poor actions (high randomness)   | Rarely does (low randomness)                     |
| Ignores position                             | Uses position                                    |
| Treats every opponent the same               | Adapts to tendencies seen earlier in the session |

**Difficulty presets** set a target skill: Beginner 0.15, Casual 0.35, Regular 0.55, Sharp 0.75, Expert 0.92.

**How the levels measure up.** Simulated at six-handed tables, each level beats the one below it (one stronger bot against five weaker ones, 4,000 hands each):

| Matchup              | Big blinds won per 100 hands |
| -------------------- | ---------------------------- |
| Casual over Beginner | +71                          |
| Regular over Casual  | +102                         |
| Sharp over Regular   | +30                          |
| Expert over Sharp    | +57                          |
| Expert over Beginner | +201                         |

Results are noisy at this sample size. Hands played fall from about 59% at Beginner to 28% at Expert, and players are all-in in only 3–7% of hands. A regression test guards this behaviour.

**Auto is the default.** It sets the target from the player's own skill estimate plus a small stretch, so the table is slightly challenging. The estimate (`learning/skill.ts`) starts from lessons completed and skill mastery. As the player makes decisions with the coach off, those decisions count for more.

When a table is created, each bot's skill is drawn from a narrow band around the target, so a table has a natural mix. Skill then stays fixed for that session. Auto is re-evaluated when the next session starts.

## Testing strategy

- Exhaustive enumeration for the evaluator.
- Scripted hands for rule edge cases.
- Property tests over thousands of seeded hands: chips are conserved and only legal actions occur.
