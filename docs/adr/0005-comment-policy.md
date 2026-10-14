# 5. Short comments in code, rationale in docs

Date: 2026-10-14 · Status: accepted

## Context

Long comments drift from the code, cost context for every reader, human or agent, and multiply
when code is written with AI assistance. supaslot adopted a lint rule against them; this repo
takes the same rule from the start.

## Decision

`local/comment-density` (in `tools/eslint-rules/`, copied from supaslot) fails the lint when:

- a comment run inside a function exceeds **2** lines,
- any other comment block (file header, JSDoc) exceeds **5** content lines,
- comments make up more than **20%** of a file's non-blank lines (files of 20+ lines).

Directives (`eslint-disable … -- reason`, `@ts-expect-error`) are not counted. Rationale goes
in `docs/ARCHITECTURE.md` or an ADR, and the code keeps a one-line "why" that points there.

## Consequences

Names and types carry more of the meaning. The limits are rule options in
`eslint.config.ts`; changing them is a policy change and belongs in its own reviewed PR.
