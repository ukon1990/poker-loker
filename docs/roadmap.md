# Roadmap

Status: ✅ done · 🚧 in progress · ⏳ waiting · ⬜ not started

| #   | Phase                                                                 | Status |
| --- | --------------------------------------------------------------------- | ------ |
| 1   | Groundwork                                                            | ✅     |
| 2   | Design artifact and approval                                          | ✅     |
| 3   | Design system in code: tokens, cards, chips, buttons, feedback states | ✅     |
| 4   | Engine: betting state machine, pots, bots, equity worker              | ✅     |
| 5   | Lesson player, exercises, glossary, units 1–3, XP, streaks, path      | ✅     |
| 6   | Simulation table: setup, play, resume, coach, hand history            | ✅     |
| 7   | Review sessions, progress screen, Hold'em units 4–8                   | ✅     |
| 8   | Final icons, PWA polish, deployment guide, optional deploy            | ⬜     |

The design was approved on 2026-11-08.

## Phase 1 checklist

- [x] Git repository and tooling (Vite, React, TypeScript, Tailwind, Biome, Vitest, Playwright)
- [x] `/docs`
- [x] Router and placeholder routes
- [x] PWA manifest, service worker, update prompt, placeholder icons
- [x] Dexie schema, repositories, backup export/import
- [x] Engine foundations: cards, seeded RNG, variant model, Hold'em definition, hand evaluator
