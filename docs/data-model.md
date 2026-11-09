# Data model

IndexedDB through Dexie. The schema is in `frontend/src/db/schema.ts`, repositories are in `frontend/src/db/repositories.ts`.

| Table            | Key                    | Holds                                                           |
| ---------------- | ---------------------- | --------------------------------------------------------------- |
| `profile`        | `id` (singleton)       | XP, current and longest streak, last active day, active variant |
| `settings`       | `id` (singleton)       | Daily goal, coach, sound, theme                                 |
| `lessonProgress` | `[variantId+lessonId]` | Status, best score, completion time                             |
| `skillMastery`   | `[variantId+skillId]`  | Leitner box, due day, correct and incorrect counts              |
| `attempts`       | auto-increment         | One row per exercise answer                                     |
| `dailyActivity`  | `day`                  | XP earned per local day                                         |
| `playSessions`   | `id`                   | Table config, bots, stacks, resumable hand state                |
| `handHistory`    | `id`                   | Seed, action log, result for each finished hand                 |

Anything specific to a game carries a `variantId`, so a new variant needs no schema change.

Terminology needs no table of its own. Glossary content is static curriculum data, and how well a player knows a term is a `skillMastery` row with a `term:` prefix, such as `term:flop`.

Days are stored as local-calendar `YYYY-MM-DD` strings, because a streak follows the player's own day and not UTC.

## Migrations

There is one schema version so far. To change the schema, add `this.version(n).stores(...).upgrade(...)` in `PokerDb`, keep all earlier versions, and bump `BACKUP_VERSION` if the shape of stored rows changes.

## Backup

Browsers can evict local data, and Safari is especially aggressive with sites that are not installed. Two safeguards:

- The app asks for persistent storage (`navigator.storage.persist()`) on the first user interaction. Firefox shows a prompt for this, which is why it does not run at page load.
- Settings has JSON export and import. Import validates the whole file first and replaces all data inside one transaction, so a bad file cannot leave partial data.
