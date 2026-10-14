# Architecture

timetracker records what is on screen (window titles and process names, never content) every
few seconds, and every 15 minutes asks a local model to turn that block into an entry: project
and activity. People correct entries; corrections become the eval set and few-shot examples.
The README explains usage; this file explains the code.

## Data flow

```
sampler (Win32, every 5 s) ──redact──▶ samples
                                          │ each finished block
                                          ▼
                              evidence ──▶ prompt (+ recent corrections) ──▶ Ollama
                                          │                                    │
                                          ▼                                    ▼
                                       entries ◀──────────── guess (project, activity)
                                          │
                     labels (review, label, accept, MCP relabel) override entries
                                          │
                                          ▼
                       review · eval · hours · timesheet CSV · MCP tools
```

`run` does sampling and summarizing in one process, on two timers. Blocks are summarized
oldest first; a failure (Ollama down) stops at that block and the next minute retries it, so
the database never has a gap that later blocks skipped over. Because of that, only samples from
the newest entry's block on are looked at: a sample written into an older block afterwards (a
clock set back, say) is kept but never summarized.

## Layers

`src/` is a functional core with an imperative shell. Dependencies point down only, and
ESLint enforces every arrow (`eslint.config.ts`).

```
src/cli.ts      entry point: parses argv, opens config and database, wires real I/O
   │
src/app/        Orchestration: track (sample, summarize), entries (review, correct, report),
   │            mcp-server (the agent tools), cli (command bodies).
   │
src/infra/      One kind of I/O per module: store (SQLite), sampler (Win32), ollama (HTTP),
   │            config-file, time (clock and local time zone), schedule (timers).
   │
   ├─ src/views/     Text: the evidence summary, the LLM prompt, review lines, CSV, usage.
   ├─ src/adapters/  Raw input (argv, config TOML, SQLite rows, model replies) → domain types.
   └─ src/domain/    Rules: blocks and evidence, redaction, totals, timesheets, accuracy.
         └─ src/shared/  Result, narrowing unknown values, reading caught errors.
```

| Layer      | May import                           | I/O and globals | Style                 |
| ---------- | ------------------------------------ | --------------- | --------------------- |
| `shared`   | nothing in `src/`                    | none            | functional (enforced) |
| `domain`   | `shared`                             | none            | functional (enforced) |
| `views`    | `domain` (types only), `shared`      | none            | functional (enforced) |
| `adapters` | `domain`, `shared`                   | none            | functional (enforced) |
| `infra`    | `adapters`, `domain`, `shared`, Node | yes             | shell (`lite` preset) |
| `app`      | everything above, Node               | yes             | shell (`lite` preset) |
| `cli.ts`   | everything                           | yes             | shell (`lite` preset) |

The core never throws: a failure is a `Result` (`src/shared/result.ts`), and the shell turns
it into an exception at one place, `unwrap` in `src/infra/unwrap.ts`. The core reads no clock
and no time zone: `src/infra/time.ts` converts between unix seconds and local day/time strings.
That is what lets the whole pipeline run in tests with an in-memory database and a fake model.

## Storage

SQLite via `node:sqlite` (built into Node, nothing to compile). Three tables: `samples`,
`entries` (one per block, the model's guess and the evidence text it saw) and `labels` (a
person's correction per block). A label always wins over the entry in reports. Times are unix
seconds; blocks are aligned to multiples of the block length, by domain `blockStart` only (the
SQL never aligns). The database runs in WAL mode with a 5 s busy timeout, because `run` writes
every few seconds while `mcp`, `review` and `label` use it from other processes.

## Rules, and what enforces them

| Rule                                                                  | Enforced by                                                         |
| --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Layer imports, as above                                               | ESLint `no-restricted-imports` per directory                        |
| No Node built-ins, `process`, `Date` or timers in the core            | ESLint `no-restricted-imports` / `no-restricted-globals`            |
| Functional core: no `let`, loops, mutation, `throw`, classes          | `eslint-plugin-functional` (`recommended`) on the core              |
| Shell: no `let`, loops or mutation; state lives in `Cell`             | `eslint-plugin-functional` (`lite`) on infra, app and entry         |
| Strictest TypeScript: no `any`, no casts in `src/`, exhaustive checks | `tsconfig.json` + typescript-eslint `strictTypeChecked`             |
| External data enters as `unknown` and is checked in an adapter        | `consistent-type-assertions: never` in `src/`                       |
| Short comments: ≤2 lines in a function, ≤5 per block, ≤20% of a file  | `local/comment-density` (`tools/eslint-rules/`)                     |
| Rule suppressions must say why                                        | eslint-comments `require-description`; unused directives are errors |
| Small units: complexity ≤10, ≤60 lines per function, ≤250 per file    | ESLint `complexity`, `max-lines-per-function`, `max-lines`          |
| No dead exports, files or dependencies                                | knip                                                                |
| Core fully tested: 100% lines, 90% branches                           | vitest coverage thresholds                                          |
| Formatting                                                            | Prettier                                                            |

All of it runs as `pnpm run check`, in CI and in the lefthook pre-push hook. Decisions behind
the rules are in [ADR 0004](adr/0004-layered-functional-core.md) and
[ADR 0006](adr/0006-guardrails-for-ai-assisted-work.md).
