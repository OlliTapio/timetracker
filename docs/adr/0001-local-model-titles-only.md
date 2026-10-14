# 1. A local model over window titles, in 15-minute blocks

Date: 2026-10-14 · Status: accepted

## Context

Manual time tracking gets skipped; automatic trackers either send screen data to a cloud
service or only count time per app, which says nothing about which project the time was for.

## Decision

- Sample every 5 seconds: the focused window (where typing goes), the window under the cursor
  when it differs (usually reading or scrolling on another monitor), and idle time. Titles and
  process names only, never screen content. Regexes in `redact` strip titles before storage.
- Every finished 15-minute block, a small local model (Ollama, `qwen2.5:7b-instruct`) reads a
  summary of the block and answers `{project, activity, confidence}` in JSON mode. A block with
  no activity is `Idle` without asking the model. A reply naming an unknown project is stored
  as `Unknown` rather than dropped.
- People correct entries (`label`, `accept`, the MCP `relabel` tool). A label always wins in
  reports. Labels are the eval set, and the most recent corrections are the model's few-shot
  examples.
- Nothing leaves the machine.

## Consequences

Accuracy depends on titles being informative; the eval says how well it works for one
person's projects. More signals (scroll and click counts, audio, screenshots through a vision
model) are possible later, each kept only if the eval shows it helps.
