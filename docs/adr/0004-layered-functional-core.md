# 4. A layered functional core with an imperative shell

Date: 2026-10-14 · Status: accepted

## Context

The Python version was a dozen flat modules, each mixing rules with SQLite and HTTP calls, so
the rules (block evidence, label precedence, accuracy) could only be tested through a database.
supaslot's layout solved the same problem and is enforced by lint, which matters in a repo
mostly changed by coding agents.

## Decision

- Layers as in `docs/ARCHITECTURE.md`, with every import direction enforced by ESLint, using
  supaslot's `eslint.config.ts` with the entry point renamed.
- The core (`shared`, `domain`, `views`, `adapters`) is pure: no Node built-ins, no `process`,
  `Date` or timers, no `let`, loops, mutation, `throw` or classes. A failure is a `Result`,
  which the shell unwraps at one place.
- Local time lives in `src/infra/time.ts`: the core works in unix seconds and receives day and
  time strings already formatted, since time-zone conversion reads the environment.
- The LLM prompt is a view: it is text built from domain values, and tests pin it.
- The shell (`infra`, `app`, `cli.ts`) runs `eslint-plugin-functional`'s `lite` preset.
  Repeating work (sampling, summarizing) is `every` in `src/infra/schedule.ts`, which
  schedules the next run after the previous one finishes, so a slow model call never overlaps
  the next.

## Consequences

The whole pipeline (samples to entries to reports to MCP tools) runs in tests against an
in-memory database and a fake model, in about three seconds. The Win32 sampler is the one
piece tested only on Windows.
