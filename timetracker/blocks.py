"""Turn raw samples into per-block evidence the model can label."""
from collections import Counter
from dataclasses import dataclass, field


@dataclass
class Evidence:
    active_s: float = 0.0
    idle_s: float = 0.0
    focus: Counter = field(default_factory=Counter)        # (process, title) -> seconds
    cursor_only: Counter = field(default_factory=Counter)  # cursor on a different window

    def to_text(self, top: int = 8) -> str:
        lines = [f"Active {self.active_s / 60:.1f} min, idle {self.idle_s / 60:.1f} min."]
        if self.focus:
            lines.append("Focused windows (minutes):")
            lines += [f"- {s / 60:.1f}  {p} | {t}" for (p, t), s in self.focus.most_common(top)]
        if self.cursor_only:
            lines.append("Cursor over another window, e.g. reading or scrolling (minutes):")
            lines += [f"- {s / 60:.1f}  {p} | {t}" for (p, t), s in self.cursor_only.most_common(top)]
        return "\n".join(lines)


def block_start(ts: float, minutes: int) -> float:
    size = minutes * 60
    return ts - ts % size


def evidence(samples, sample_seconds: float, idle_after: float) -> Evidence:
    ev = Evidence()
    for s in samples:
        if s["idle_s"] >= idle_after:
            ev.idle_s += sample_seconds
            continue
        ev.active_s += sample_seconds
        fg = (s["fg_process"], s["fg_title"])
        ev.focus[fg] += sample_seconds
        cur = (s["cursor_process"], s["cursor_title"])
        if cur[0] and cur != fg:
            ev.cursor_only[cur] += sample_seconds
    return ev
