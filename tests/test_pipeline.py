import json

from timetracker import blocks, llm, review, summarize
from timetracker.config import Config
from timetracker import db

T0 = 1_760_000_400.0  # block-aligned (divisible by 900)


def _cfg(tmp_path):
    return Config(projects=["Sono", "Job search"], db_path=str(tmp_path / "t.db"))


def _insert(con, ts, fg, cursor=("", ""), idle=0.0):
    con.execute("INSERT INTO samples VALUES (?, ?, ?, ?, ?, ?)", (ts, *fg, *cursor, idle))


def test_evidence_counts_focus_cursor_and_idle():
    rows = [
        {"fg_process": "code.exe", "fg_title": "pr.py", "cursor_process": "code.exe",
         "cursor_title": "pr.py", "idle_s": 1},
        {"fg_process": "code.exe", "fg_title": "pr.py", "cursor_process": "chrome.exe",
         "cursor_title": "Docs", "idle_s": 1},
        {"fg_process": "code.exe", "fg_title": "pr.py", "cursor_process": "", "cursor_title": "",
         "idle_s": 500},
    ]
    ev = blocks.evidence(rows, 5, 120)
    assert ev.active_s == 10 and ev.idle_s == 5
    assert ev.focus[("code.exe", "pr.py")] == 10
    assert ev.cursor_only == {("chrome.exe", "Docs"): 5}
    assert "Cursor over another window" in ev.to_text()


def test_parse_rejects_unknown_project_and_bad_json():
    assert llm.parse('{"project": "Golf", "activity": "x"}', ["Sono"])["project"] == "Unknown"
    assert llm.parse("not json", ["Sono"])["confidence"] == 0.0
    assert llm.parse('{"project": "Idle"}', ["Sono"])["project"] == "Idle"


def test_summarize_labels_finished_blocks_only(tmp_path):
    cfg = _cfg(tmp_path)
    con = db.connect(cfg.db_path)
    for i in range(10):
        _insert(con, T0 + i * 5, ("code.exe", "booking.py"))
    for i in range(10):
        _insert(con, T0 + 900 + i * 5, ("chrome.exe", "Nebius application"))
    _insert(con, T0 + 1800, ("chrome.exe", "LinkedIn"))  # current block: not summarized yet
    con.commit()

    seen = []

    def fake(url, model, msgs):
        seen.append(msgs[-1]["content"])
        project = "Sono" if "booking" in msgs[-1]["content"] else "Job search"
        return json.dumps({"project": project, "activity": "work", "confidence": 0.9})

    assert summarize.summarize_pending(cfg, now=T0 + 1800 + 10, call=fake) == 2
    assert summarize.summarize_pending(cfg, now=T0 + 1800 + 10, call=fake) == 0  # idempotent
    got = [r["project"] for r in con.execute("SELECT project FROM entries ORDER BY block_start")]
    assert got == ["Sono", "Job search"]


def test_idle_block_skips_the_model(tmp_path):
    cfg = _cfg(tmp_path)
    con = db.connect(cfg.db_path)
    _insert(con, T0, ("x.exe", "x"), idle=999)
    con.commit()

    def boom(*a):
        raise AssertionError("model called for an idle block")

    assert summarize.summarize_pending(cfg, now=T0 + 900, call=boom) == 1


def test_corrections_feed_eval_and_few_shot(tmp_path):
    cfg = _cfg(tmp_path)
    con = db.connect(cfg.db_path)
    for b, proj in [(T0, "Sono"), (T0 + 900, "Sono")]:
        con.execute("INSERT INTO entries VALUES (?, ?, 'a', 0.5, 'm', 'evidence text')", (b, proj))
    con.execute("INSERT INTO labels VALUES (?, 'Job search', 'cv')", (T0 + 900,))
    con.execute("INSERT INTO labels VALUES (?, 'Sono', 'a')", (T0,))
    con.commit()
    res = review.evaluate(cfg)
    assert res["blocks"] == 2 and res["accuracy"] == 0.5
    assert res["top_errors"] == [(("Job search", "Sono"), 1)]
    ex = summarize._examples(con, cfg)
    assert ex == [("evidence text", {"project": "Job search", "activity": "cv", "confidence": 1.0})]
