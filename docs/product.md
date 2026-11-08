# Product

## Vision

A learn-to-play app for poker that feels like a language-learning course: short lessons on a skill path, instant feedback, daily streaks, and review of whatever you keep getting wrong. When you are ready to use what you learned, you can sit down at a simulated table against bots, with an optional coach explaining each decision.

The learning mechanics are inspired by Duolingo. The name, look, and characters are original.

## Audience

Someone who does not yet know poker. The course starts from what the cards and hand rankings are and works up to pot odds and post-flop thinking.

## Hard constraints

- Runs entirely in the browser. No backend, no accounts, no SSR.
- Deployable as static files, for example to an S3 bucket.
- Installable PWA that works offline.
- All progress lives on the device, in IndexedDB through Dexie, with export/import as a safeguard.
- Texas Hold'em first, without assumptions that block other variants later.

## Scope for v1

- No-Limit Texas Hold'em course in eight units (see [curriculum.md](curriculum.md)).
- Taught poker terminology: new words in lessons, tappable terms everywhere, and a searchable glossary.
- XP, daily goal, streak, skill path, spaced review of weak skills.
- Exercises generated from seeds, with options and answers calculated by the engine, so no two play-throughs are the same.
- Cash-game simulation: 2–9 seats, default 6, rebuys allowed, against bots with distinct personalities and a pre-set skill level.
- Difficulty follows the player's own skill by default, and can be set by hand.
- Toggleable coach and a browsable hand history.

## Product decisions

- **No hearts or lives.** A wrong answer returns the question to the end of the lesson. Limiting practice does not help anyone learn.
- **Honest coaching.** Bots and coach are heuristic, not a game-theory solver. The app teaches sound fundamentals and does not call a move "optimal".
- **English UI first.** Lesson text lives in the curriculum data so it can be translated later.

## Out of scope for v1

Real-money play, multiplayer, accounts, cloud sync, tournaments, other variants (the engine is built to allow them).
