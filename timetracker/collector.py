import re
import time

from . import db
from .config import Config


def redact(title: str, patterns: list[str]) -> str:
    for p in patterns:
        title = re.sub(p, "[redacted]", title)
    return title


def run(cfg: Config, sample=None) -> None:
    if sample is None:
        from .sampler import sample
    con = db.connect(cfg.db_path)
    while True:
        s = sample()
        for k in ("fg_title", "cursor_title"):
            s[k] = redact(s[k], cfg.redact)
        con.execute(
            "INSERT INTO samples VALUES (?, ?, ?, ?, ?, ?)",
            (time.time(), s["fg_process"], s["fg_title"],
             s["cursor_process"], s["cursor_title"], s["idle_s"]))
        con.commit()
        time.sleep(cfg.sample_seconds)
