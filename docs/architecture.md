# Architecture

## Stack

| Concern                   | Choice                                     |
| ------------------------- | ------------------------------------------ |
| Build                     | Vite 8, React 19, TypeScript, pnpm         |
| Routing                   | TanStack Router, file-based, hash history  |
| Async data over Dexie     | TanStack Query                             |
| Live table and hand state | TanStack Store                             |
| Forms                     | TanStack Form                              |
| Hand history              | TanStack Table and Virtual                 |
| Debounced saves           | TanStack Pacer                             |
| Keyboard play             | TanStack Hotkeys                           |
| Storage                   | Dexie 4 (IndexedDB)                        |
| PWA                       | vite-plugin-pwa (generateSW)               |
| Styling                   | Tailwind 4 with CSS-variable design tokens |
| Tests and lint            | Vitest, fake-indexeddb, Playwright, Biome  |

## Layout

```
src/
  engine/       Pure TypeScript: no React, no DOM, deterministic
    core/       Cards, deck, seeded RNG, combinations
    eval/       Hand ranking
    variants/   VariantDefinition and one file per variant
    bots/       Weighted decisions, personas, difficulty
    equity/     Monte Carlo equity
    coach/      Rule-of-thumb advice
    worker/     Runs bots and coach off the main thread
  curriculum/   Typed course data, glossary, exercise generators
  learning/     XP, streaks, mastery, scheduling
  db/           Dexie schema, repositories, query options, backup
  features/     Screens' logic: pwa, lesson player, table, coach, progress
  ui/           (phase 3) Design system
  routes/       File-based routes, thin: load data, render a feature
```

## Dependency direction

`routes → features → (ui, learning, curriculum, db, engine)`. The engine imports nothing outside itself. That keeps it testable in Node and able to run inside a Web Worker.

## Data flow

Dexie is the source of truth for everything that persists.

- **Reads:** a route loader calls `queryClient.ensureQueryData(...)`, and the component reads with `useSuspenseQuery`.
- **Writes:** a mutation calls a repository function in `src/db`, then invalidates the matching query.
- **Query defaults** are set in `src/db/query-client.ts`. `networkMode: 'always'` is essential, because Query's default pauses when the device is offline, and this app has no network dependency. `staleTime: Infinity` is correct because Dexie changes only through our own mutations.

The live hand being played is held in TanStack Store for fast updates, and is saved to Dexie (debounced) so it can resume after a reload.

## Routes

| Path                 | Purpose                      |
| -------------------- | ---------------------------- |
| `#/`                 | Skill path                   |
| `#/lesson/$lessonId` | Lesson player                |
| `#/practice`         | Review of weak skills        |
| `#/play`             | Table setup and session list |
| `#/play/$sessionId`  | Simulation table             |
| `#/progress`         | Stats and streak             |
| `#/glossary`         | Searchable poker terminology |
| `#/history`          | Hand history                 |
| `#/settings`         | Settings, backup             |

Hash routing means a static host needs no rewrite rules. See [deployment.md](deployment.md).
