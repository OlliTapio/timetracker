"""Daily review and the accuracy eval. Corrections become labels (and few-shot examples)."""
import datetime as dt
from collections import Counter

from . import blocks, db
from .config import Config


def _day_range(day: str) -> tuple[float, float]:
    d = dt.datetime.fromisoformat(day)
    return d.timestamp(), (d + dt.timedelta(days=1)).timestamp()


def show(cfg: Config, day: str) -> list[str]:
    con = db.connect(cfg.db_path)
    lo, hi = _day_range(day)
    rows = con.execute(
        "SELECT e.*, l.project AS l_project, l.activity AS l_activity FROM entries e "
        "LEFT JOIN labels l USING (block_start) WHERE block_start >= ? AND block_start < ? "
        "ORDER BY block_start", (lo, hi)).fetchall()
    out = []
    for r in rows:
        t = dt.datetime.fromtimestamp(r["block_start"]).strftime("%H:%M")
        mark = "" if r["l_project"] is None else f"  -> {r['l_project']}: {r['l_activity'] or ''}"
        out.append(f"{t}  {r['project']:<12} {r['activity']}  ({r['confidence']:.1f}){mark}")
    return out


def _block(day: str, hhmm: str) -> float:
    return dt.datetime.fromisoformat(f"{day}T{hhmm}").timestamp()


def label(cfg: Config, day: str, hhmm: str, project: str, activity: str = "") -> None:
    con = db.connect(cfg.db_path)
    con.execute("INSERT OR REPLACE INTO labels VALUES (?, ?, ?)",
                (blocks.block_start(_block(day, hhmm), cfg.block_minutes), project, activity))
    con.commit()


def accept(cfg: Config, day: str) -> int:
    """Mark every unlabelled entry of the day as correct."""
    con = db.connect(cfg.db_path)
    lo, hi = _day_range(day)
    cur = con.execute(
        "INSERT OR IGNORE INTO labels SELECT block_start, project, activity FROM entries "
        "WHERE block_start >= ? AND block_start < ?", (lo, hi))
    con.commit()
    return cur.rowcount


def evaluate(cfg: Config) -> dict:
    con = db.connect(cfg.db_path)
    rows = con.execute("SELECT e.project AS pred, l.project AS gold FROM entries e "
                       "JOIN labels l USING (block_start)").fetchall()
    n = len(rows)
    hits = sum(r["pred"] == r["gold"] for r in rows)
    errors = Counter((r["gold"], r["pred"]) for r in rows if r["pred"] != r["gold"])
    return {"blocks": n, "accuracy": hits / n if n else None,
            "top_errors": errors.most_common(5)}
