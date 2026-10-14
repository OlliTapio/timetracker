# 3. One machine, no container

Date: 2026-10-14 · Status: accepted

## Context

The first design ran the model on a second PC over the LAN. Development and use now happen on
one Windows machine, with a model server as an option for later.

## Decision

- Ollama runs on the same machine, at `localhost:11434`. `ollama_url` stays a setting, so a
  server later is a config change; the database stays behind `src/infra/store.ts` for the same
  reason.
- No dev container. Sampling must run on the interactive Windows desktop, which a container
  cannot see, and the model wants the GPU directly. Reproducibility comes from `.nvmrc`, the
  pinned `packageManager`, the lockfile, and CI running the same `pnpm run check`.
- `run` samples and summarizes in one process.

## Consequences

The model shares the GPU with everything else on the machine, games included. Summarizing is
not urgent: an unsummarized block waits and is written on a later run. If a server arrives,
that part can be containerized on its own.
