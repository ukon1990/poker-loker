# Design

✅ Approved on 2026-11-08. Source: [Poker Loker Design](https://claude.ai/artifact/FE6QXubwVk46NG9ufVK3es)

## Concept

Each lesson is a playing card you collect. A unit is a suit, finished lessons are face up, the current lesson has a red ring, and locked lessons are face down. Poker terms have a dotted underline and can be tapped anywhere. The look is original.

## Colour

Tokens live in `src/styles.css`. Playing cards keep their paper colours in dark mode, like real cards.

| Token     | Role                          | Light     | Dark      |
| --------- | ----------------------------- | --------- | --------- |
| Ground    | Page background               | `#FAFAF7` | `#121417` |
| Surface   | Panels                        | `#FFFFFF` | `#1C1F24` |
| Ink       | Text, primary buttons         | `#15171A` | `#F2F1EC` |
| Ink 2     | Secondary text                | `#585D66` | `#A6ABB3` |
| Line      | Borders, tracks               | `#E5E4DF` | `#2E3238` |
| Red       | Streak, current lesson, wrong | `#C4122F` | `#FF5A6E` |
| Red tint  | Wrong answer panel            | `#FCEBED` | `#3A1B21` |
| Felt      | Table, right answers          | `#0E5B49` | `#0E5B49` |
| Felt tint | Right answer panel            | `#E4F1ED` | `#15332C` |

## Type

Both fonts are bundled with the app so they work offline.

| Use                               | Style            |
| --------------------------------- | ---------------- |
| Card ranks, wordmark, big numbers | Zilla Slab 700   |
| Screen title                      | Figtree 800, 28  |
| Section                           | Figtree 700, 20  |
| Reading text                      | Figtree 400, 16  |
| Labels                            | Figtree 600, 13  |
| A poker word you can tap          | Dotted underline |

## Components (`src/ui`)

- **PlayingCard:** sizes `xxs`, `xs`, `sm`, `md`, `lg`, with face-down `felt` and `quiet` backs, an optional ring, and a slight tilt.
- **Chip:** `red`, `felt`, `ink`, and `paper` tones.
- **Buttons:** primary (ink), outline, felt, red, and disabled. At least 44 px tall.
- **Feedback:** tinted panels that always pair colour with an icon and words.
- **Sheet:** bottom sheet for term definitions.

## Layout

- **Phone:** four bottom tabs: Learn, Practice, Play, Progress. Lessons and the table are full screen.
- **Desktop:** left rail that adds Glossary, History, and Settings.
