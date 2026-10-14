# Agent instructions

timetracker: samples window titles on Windows every few seconds and has a local model (Ollama)
write a time entry per 15-minute block. Read `docs/ARCHITECTURE.md` before changing structure;
the reasons behind the design are in `docs/adr/`.

## Commands

|                            |                                             |
| -------------------------- | ------------------------------------------- |
| `pnpm run check`           | **Definition of done.** Everything CI runs. |
| `pnpm run check:fast`      | Types, lint, tests. Run it often.           |
| `pnpm exec vitest run <p>` | One test file or directory.                 |
| `pnpm tt <command>`        | Run the app (`node src/cli.ts`); no build.  |

## Rules

- Rules go in `src/domain`, text in `src/views` (the LLM prompt is text), raw-input parsing in
  `src/adapters`, I/O in `src/infra` (one concern per module), orchestration in `src/app`. The
  linter enforces the layers; when it complains, move the code, don't suppress the rule.
- The core is functional: `const`, `map`/`filter`/`reduce`, a `Result` instead of `throw`.
  The shell has no `let` or loops either; use `src/infra/sequence.ts` and `Cell`.
- Imports use `.ts` extensions: Node runs the sources directly.
- Write the failing test first, in `test/` at the path mirroring the source.
- Comments: one-line "why", at most 2 lines inside a function. Longer reasoning goes in
  `docs/ARCHITECTURE.md` or a new ADR in `docs/adr/`.
- Never loosen `tsconfig.json`, `eslint.config.ts`, coverage thresholds or hooks to make a
  check pass. Fix the code, or ask.
- Error messages name the cause and what to do. Tests pin them; keep them stable.
- Privacy: only window titles and process names are stored, never screen content. Don't add a
  signal that reads content without an ADR.

## Environment

- Windows is the target: sampling uses the Win32 API through koffi (`src/infra/sampler.ts`).
  Everything else runs and is tested on any OS; CI runs Windows and Linux.
- Node ≥ 24.2 (see `.nvmrc`), which runs `.ts` files directly. pnpm (version in
  `package.json` `packageManager`); without it on PATH, `npx pnpm@<that version>`.
- One machine: Ollama runs locally at `localhost:11434`. Tests never call it; they inject a
  fake `Chat`.
- Git hooks (lefthook, `lefthook.yml`) check staged files on commit and run `check` on push.
  Never pass `--no-verify`; a Claude hook refuses it.
- Hooks in `.claude/settings.json` lint after each edit and run `check:fast` before a
  session ends. Their output is the fix list.
