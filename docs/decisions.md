# Decision log

Newest first.

## 2026-11-08: Initial decisions

| Decision                                           | Why                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Hash routing                                       | A static bucket has no rewrite rules, so deep links and reloads would otherwise fail       |
| Plain TanStack Router, not TanStack Start          | No SSR is wanted, and Start adds server concepts the app does not need                     |
| TanStack Query over Dexie, not `dexie-react-hooks` | Keeps to the TanStack stack and works with router loaders                                  |
| No TanStack DB                                     | Still a release candidate, and Query over Dexie covers the need                            |
| Own poker engine, no third-party library           | The engine has to fit the variant model and be replayable from a seed                      |
| Cards as integers                                  | Monte Carlo equity evaluates hands many thousands of times                                 |
| Service worker in prompt mode                      | An automatic update could reload the page during a hand                                    |
| `start_url` is `./index.html`                      | The bare S3 HTTPS endpoint does not resolve `/` to the index file                          |
| Ask for persistent storage on first interaction    | Firefox shows a permission prompt, which is rude at page load                              |
| Leitner boxes rather than FSRS or SM-2             | Simple to explain and enough for a course of this size. Can be replaced behind `learning/` |
| No hearts or lives                                 | Limiting practice does not help anyone learn                                               |
| Cash game before tournaments                       | Fewer concepts for a beginner, and rebuys keep play going                                  |
| Terms taught in context, not in a vocabulary unit  | A word sticks better when it is learned at the moment it is needed                         |
| Terms are skills (`term:flop`)                     | They reuse spaced review, with no extra table or scheduler                                 |
| Looking up a term at the table adds it to review   | Needing to look it up is the best signal that it has not stuck                             |
| Exercises are generated, answers calculated        | Variety on every play-through, and a wrong answer key cannot exist                         |
| Bots choose by weighted random over action values  | Reacts to the actual cards and betting while staying unpredictable                         |
| Difficulty only affects decision quality           | Rigging cards would teach the wrong lessons and would not be fair                          |
| Bot skill is fixed for a session                   | Changing strength mid-session would feel like rubber-banding                               |
| Auto difficulty is the default                     | A beginner should never have to guess which level suits them                               |
| Coached decisions do not count toward skill        | Following the coach's advice says little about the player's own judgment                   |
