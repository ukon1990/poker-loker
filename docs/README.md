# Poker Loker docs

This folder is the living plan for the app. It is updated in every phase of the work, so if a doc and the code disagree, treat that as a bug in the doc.

| Doc                                | What it covers                                 |
| ---------------------------------- | ---------------------------------------------- |
| [product.md](product.md)           | Vision, audience, scope                        |
| [roadmap.md](roadmap.md)           | Phases and current status                      |
| [architecture.md](architecture.md) | Stack, folder layout, data flow                |
| [engine.md](engine.md)             | Poker engine, variant model, rules, bots       |
| [curriculum.md](curriculum.md)     | Course structure, exercise types, gamification |
| [data-model.md](data-model.md)     | Dexie tables, migrations, backup               |
| [design.md](design.md)             | Visual design, finalized after approval        |
| [deployment.md](deployment.md)     | Hosting on S3 and PWA requirements             |
| [decisions.md](decisions.md)       | Log of decisions and why they were made        |

## Commands

| Command                                            | Purpose                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| `pnpm dev`                                         | Dev server (the service worker only exists in the production build) |
| `pnpm typecheck`                                   | TypeScript                                                          |
| `pnpm lint`                                        | Biome lint and format check                                         |
| `pnpm test`                                        | Unit tests                                                          |
| `pnpm test:e2e`                                    | Playwright against the production build                             |
| `pnpm build`                                       | Production build into `dist/`                                       |
| `DEPLOY_TARGET=user@host:/path pnpm deploy:server` | Upload the build to an Apache or nginx server                       |
| `S3_BUCKET=name pnpm deploy:s3`                    | Upload the build to S3                                              |
