"""MCP server: lets an agent (Claude Code, Claude Desktop, …) read, correct and export entries.

Run: python -m timetracker.mcp_server   (stdio). Reads config.toml from the working directory.
"""
import os

from mcp.server import MCPServer

from . import config, report, review

cfg = config.load(os.environ.get("TIMETRACKER_CONFIG", "config.toml"))
server = MCPServer(
    "timetracker",
    instructions=(
        "Local time-tracking data in 15-minute blocks. Dates are YYYY-MM-DD, times HH:MM, local "
        "time. Corrections (relabel) override the model's entries everywhere and become examples "
        "for the model. Check block_evidence before relabelling when unsure."),
)


@server.tool()
def list_projects() -> list[str]:
    """Projects an entry can be assigned to."""
    return cfg.projects + ["Idle"]


@server.tool()
def list_entries(day_from: str, day_to: str) -> list[dict]:
    """Entries between two dates (inclusive), corrections applied."""
    return report.entries(cfg, day_from, day_to)


@server.tool()
def block_evidence(day: str, time: str) -> str:
    """What was on screen during one block: focused windows, cursor-only windows, idle time."""
    return report.evidence(cfg, day, time)


@server.tool()
def relabel(day: str, time_from: str, time_to: str, project: str, activity: str = "") -> str:
    """Correct the blocks from time_from up to time_to (exclusive) on one day."""
    n = report.relabel(cfg, day, time_from, time_to, project, activity)
    return f"relabelled {n} blocks"


@server.tool()
def hours_by_project(day_from: str, day_to: str) -> dict[str, float]:
    """Hours per project between two dates (inclusive)."""
    return report.totals(cfg, day_from, day_to)


@server.tool()
def export_timesheet(day_from: str, day_to: str, project: str) -> str:
    """CSV timesheet for one project: date, hours, activities."""
    return report.timesheet(cfg, day_from, day_to, project)


@server.tool()
def accuracy() -> dict:
    """How often the model's project matched the corrections, and its most common mix-ups."""
    return review.evaluate(cfg)


if __name__ == "__main__":
    server.run()
