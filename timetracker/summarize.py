import json
import time

from . import blocks, db, llm
from .config import Config


def _examples(con, cfg: Config, limit: int = 4):
    """Recent corrected blocks, so the model learns this person's projects."""
    rows = con.execute(
        "SELECT e.evidence, l.project, l.activity FROM labels l JOIN entries e USING (block_start) "
        "WHERE e.project != l.project ORDER BY l.block_start DESC LIMIT ?", (limit,)).fetchall()
    return [(r["evidence"], {"project": r["project"], "activity": r["activity"] or "",
                             "confidence": 1.0}) for r in rows]


def summarize_pending(cfg: Config, now: float | None = None, call=llm.label) -> int:
    con = db.connect(cfg.db_path)
    now = time.time() if now is None else now
    size = cfg.block_minutes * 60
    current = blocks.block_start(now, cfg.block_minutes)
    first = con.execute("SELECT MIN(ts) FROM samples").fetchone()[0]
    if first is None:
        return 0
    done = 0
    start = blocks.block_start(first, cfg.block_minutes)
    while start < current:  # only completed blocks
        if not con.execute("SELECT 1 FROM entries WHERE block_start = ?", (start,)).fetchone():
            rows = con.execute("SELECT * FROM samples WHERE ts >= ? AND ts < ?",
                               (start, start + size)).fetchall()
            if rows:
                ev = blocks.evidence(rows, cfg.sample_seconds, cfg.idle_after_seconds)
                text = ev.to_text()
                if ev.active_s == 0:
                    out = {"project": "Idle", "activity": "away", "confidence": 1.0}
                else:
                    msgs = llm.build_messages(text, cfg.projects, cfg.block_minutes,
                                              _examples(con, cfg))
                    out = llm.parse(call(cfg.ollama_url, cfg.model, msgs), cfg.projects)
                con.execute("INSERT INTO entries VALUES (?, ?, ?, ?, ?, ?)",
                            (start, out["project"], out["activity"], out["confidence"],
                             cfg.model, text))
                con.commit()
                done += 1
        start += size
    return done
