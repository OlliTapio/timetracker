"""Queries over entries with corrections applied: a label always wins over the model's entry."""
import csv
import datetime as dt
import io
from collections import defaultdict

from . import blocks, db
from .config import Config

EFFECTIVE = """
SELECT e.block_start, e.project AS model_project, e.activity AS model_activity, e.confidence,
       l.project AS label_project, l.activity AS label_activity,
       COALESCE(l.project, e.project) AS project,
       COALESCE(NULLIF(l.activity, ''), e.activity) AS activity
FROM entries e LEFT JOIN labels l USING (block_start)
WHERE e.block_start >= ? AND e.block_start < ? ORDER BY e.block_start
"""


def _range(day_from: str, day_to: str) -> tuple[float, float]:
    lo = dt.datetime.fromisoformat(day_from)
    hi = dt.datetime.fromisoformat(day_to) + dt.timedelta(days=1)
    return lo.timestamp(), hi.timestamp()


def _hhmm(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M")


def entries(cfg: Config, day_from: str, day_to: str) -> list[dict]:
    con = db.connect(cfg.db_path)
    return [{"block": _hhmm(r["block_start"]), "project": r["project"], "activity": r["activity"],
             "confidence": r["confidence"], "corrected": r["label_project"] is not None}
            for r in con.execute(EFFECTIVE, _range(day_from, day_to))]


def evidence(cfg: Config, day: str, hhmm: str) -> str:
    con = db.connect(cfg.db_path)
    start = blocks.block_start(dt.datetime.fromisoformat(f"{day}T{hhmm}").timestamp(),
                               cfg.block_minutes)
    row = con.execute("SELECT evidence FROM entries WHERE block_start = ?", (start,)).fetchone()
    return row["evidence"] if row else "no entry for that block"


def relabel(cfg: Config, day: str, time_from: str, time_to: str, project: str,
            activity: str = "") -> int:
    """Correct every block from time_from up to (not including) time_to."""
    if project not in cfg.projects + ["Idle"]:
        raise ValueError(f"unknown project {project!r}; known: {cfg.projects + ['Idle']}")
    con = db.connect(cfg.db_path)
    lo = blocks.block_start(dt.datetime.fromisoformat(f"{day}T{time_from}").timestamp(),
                            cfg.block_minutes)
    hi = dt.datetime.fromisoformat(f"{day}T{time_to}").timestamp()
    cur = con.execute(
        "INSERT OR REPLACE INTO labels SELECT block_start, ?, ? FROM entries "
        "WHERE block_start >= ? AND block_start < ?", (project, activity, lo, hi))
    con.commit()
    return cur.rowcount


def totals(cfg: Config, day_from: str, day_to: str) -> dict[str, float]:
    hours: dict[str, float] = defaultdict(float)
    for e in entries(cfg, day_from, day_to):
        hours[e["project"]] += cfg.block_minutes / 60
    return dict(sorted(hours.items(), key=lambda kv: -kv[1]))


def timesheet(cfg: Config, day_from: str, day_to: str, project: str) -> str:
    """CSV, one row per day: date, hours, the distinct activities in order."""
    days: dict[str, list] = {}
    for e in entries(cfg, day_from, day_to):
        if e["project"] != project:
            continue
        d = days.setdefault(e["block"][:10], [0.0, []])
        d[0] += cfg.block_minutes / 60
        if e["activity"] and e["activity"] not in d[1]:
            d[1].append(e["activity"])
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["date", "hours", "activities"])
    for day, (h, acts) in sorted(days.items()):
        w.writerow([day, f"{h:.2f}", "; ".join(acts)])
    return out.getvalue()
