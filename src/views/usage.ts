/** @file Help text for the command line. */

export const USAGE = `Usage: timetracker <command> [--config config.toml]

  run                    Sample the screen every few seconds and write entries as blocks finish.
  summarize              Write entries for finished blocks now, then exit.
  review [day]           Show a day's entries (default today).
  label <HH:MM> <project> [activity] [--day YYYY-MM-DD]
                         Correct one block.
  accept [day]           Mark the rest of a day's entries as correct.
  eval                   Accuracy of the entries against your labels.
  mcp                    Serve the MCP tools over stdio, for an agent.`
