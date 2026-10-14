# timetracker

A local-LLM time tracker for Windows. It samples what's on screen every few seconds (focused
window, window under the cursor, idle time: titles and process names only, never screen
content), and every 15 minutes a small local model writes an entry: project + what you did.
Nothing leaves the machine.

```
timetracker run  ──samples──▶ timetracker.db ──evidence──▶ Ollama (localhost, qwen2.5:7b-instruct)
                                    ▲
review / label / accept / eval ─────┘   (and the MCP tools, for an agent)
```

## Setup

1. Install [Ollama](https://ollama.com) and `ollama pull qwen2.5:7b-instruct`.
2. Node 24 (see `.nvmrc`) and pnpm: `pnpm install`.
3. `copy config.example.toml config.toml` and edit the projects.
4. `pnpm tt run` (leave it running; Ctrl+C stops it).

## Daily review (one minute)

```
pnpm tt review                       # today's entries
pnpm tt label 14:30 "Job search" "Nebius follow-up"
pnpm tt accept                       # the rest were right
pnpm tt eval                         # accuracy against your labels
```

Corrections are fed back to the model as examples, and they are the eval set. `pnpm tt
summarize` writes entries for any finished blocks right away (e.g. after Ollama was down).

## Agent access (MCP)

Register the server with your agent, e.g. Claude Code:

```
claude mcp add timetracker -e TIMETRACKER_CONFIG=C:\path\to\config.toml -- node C:\path\to\timetracker\src\cli.ts mcp
```

Tools: `list_projects`, `list_entries`, `block_evidence`, `relabel` (a time range in one call),
`hours_by_project`, `export_timesheet` (CSV per project), `accuracy`. So the review can be a
conversation ("Tuesday 13–15 was the Nebius application, not Sono"), and delivery too ("export
last week's Sono hours"). Agent corrections are labels like any other: they feed the eval and
the model's examples.

## Multi-monitor attention

Focused window = where typing goes. Window under the cursor, when different, usually means
reading or scrolling on the other screen; it is reported separately. Planned signals, each kept
only if the eval shows it helps: scroll/click counts per window, audio and mic/camera use,
screenshots through a vision model.

## Privacy

Titles can contain email subjects and document names. Use `redact` in the config, and don't run
this on an employer's machine.

## Development

`pnpm run check` is the definition of done (format, types, lint, tests with coverage, dead
code). See `AGENTS.md`, `docs/ARCHITECTURE.md` and `docs/adr/`.
