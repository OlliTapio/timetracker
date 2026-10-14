# 6. Deterministic guardrails for AI-assisted work

Date: 2026-10-14 · Status: accepted

## Context

This repo is mostly changed by coding agents. Agents follow written rules unevenly; they
reliably respond to a failing check with a clear message. CLAUDE.md is advisory; hooks are
enforced. The setup is supaslot's (its ADR 0010), adapted to a Windows app.

## Decision

- One gate, `pnpm run check`, defines "done": format, types, lint, tests with coverage, knip.
  `check:fast` skips formatting, coverage and knip.
- Lint messages say how to fix the problem, not just what is wrong.
- Git hooks come from lefthook (`lefthook.yml`, installed by `pnpm install`) and apply to
  people and agents alike: pre-commit runs Prettier and ESLint on staged files and the
  typecheck; pre-push runs `check`. CI runs `check` on Windows and Linux for every PR.
- Claude Code hooks (`.claude/settings.json`, scripts in `.claude/hooks/`, copied from
  supaslot) cover what git hooks cannot:
  - **PreToolUse Bash** `no-verify`: refuses git commands that skip lefthook.
  - **PostToolUse Edit/Write** `after-edit`: Prettier and `eslint --fix` on the file, with
    leftover errors handed straight back to the agent.
  - **Stop** `stop-check`: with uncommitted changes, `check:fast` must pass before the
    session ends.
- `AGENTS.md` is the cross-tool instruction file, and `CLAUDE.md` imports it. It stays short
  and holds what an agent cannot learn from the code.
- Dependencies are pinned exactly, and pnpm installs only versions published at least a week
  ago (`minimumReleaseAge`), so a hijacked release has time to be caught.

## Consequences

Commits are slower by a few seconds. A broken state can still exist mid-task; the hooks make
it hard to commit or push, the Stop hook pushes back once before a session ends, and CI
refuses it at merge.
