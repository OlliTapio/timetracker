# timetracker

A local-LLM time tracker for Windows. It samples what's on screen every few seconds (focused
window, window under the cursor, idle time: titles and process names only, never screen
content), and every 15 minutes a small local model writes an entry: project + what you did.
Nothing leaves your home network.

```
main PC (RTX 5070)                         old PC (RTX 2080)
collect  -> timetracker.db                 ollama serve  (OLLAMA_HOST=0.0.0.0)
summarize --loop  -- evidence over LAN --> qwen2.5:7b-instruct
review / label / accept / eval
```

## Setup

1. Old PC: install [Ollama](https://ollama.com), `ollama pull qwen2.5:7b-instruct`, set
   `OLLAMA_HOST=0.0.0.0`, open port 11434 on the private network only.
2. Main PC: Python 3.11+; the tracker itself has no dependencies. `copy config.example.toml config.toml` and edit
   the projects and `ollama_url`.
3. Run two terminals:
   ```
   python -m timetracker collect
   python -m timetracker summarize --loop
   ```

## Daily review (one minute)

```
python -m timetracker review              # today's entries
python -m timetracker label 14:30 "Job search" "Nebius follow-up"
python -m timetracker accept              # the rest were right
python -m timetracker eval                # accuracy against your labels
```

Corrections are fed back to the model as examples, and they are the eval set.

## Agent access (MCP)

`pip install "mcp>=2,<3"`, then register the server with your agent, e.g. Claude Code:

```
claude mcp add timetracker -e TIMETRACKER_CONFIG=C:\path\to\config.toml -- python -m timetracker.mcp_server
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

## Tests

`python -m pytest` (runs on any OS; the Windows sampler is the only Windows-only part).
