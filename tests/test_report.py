import pytest

from timetracker import db, report
from timetracker.config import Config
from tests.test_pipeline import T0
import datetime as dt


def _setup(tmp_path):
    cfg = Config(projects=["Sono", "Job search"], db_path=str(tmp_path / "t.db"))
    con = db.connect(cfg.db_path)
    for i, (p, a) in enumerate([("Sono", "PR review"), ("Sono", "PR review"),
                                ("Sono", "standup"), ("Job search", "CV")]):
        con.execute("INSERT INTO entries VALUES (?, ?, ?, 0.8, 'm', 'ev')", (T0 + i * 900, p, a))
    con.commit()
    day = dt.datetime.fromtimestamp(T0).date().isoformat()
    hhmm = lambda i: dt.datetime.fromtimestamp(T0 + i * 900).strftime("%H:%M")
    return cfg, day, hhmm


def test_relabel_range_overrides_entries_and_totals(tmp_path):
    cfg, day, hhmm = _setup(tmp_path)
    assert report.totals(cfg, day, day) == {"Sono": 0.75, "Job search": 0.25}
    assert report.relabel(cfg, day, hhmm(2), hhmm(3), "Job search", "Nebius prep") == 1
    assert report.totals(cfg, day, day) == {"Sono": 0.5, "Job search": 0.5}
    rows = report.entries(cfg, day, day)
    assert [r["corrected"] for r in rows] == [False, False, True, False]
    assert rows[2]["activity"] == "Nebius prep"


def test_relabel_rejects_unknown_project(tmp_path):
    cfg, day, hhmm = _setup(tmp_path)
    with pytest.raises(ValueError):
        report.relabel(cfg, day, hhmm(0), hhmm(1), "Golf")


def test_timesheet_csv(tmp_path):
    cfg, day, _ = _setup(tmp_path)
    csv = report.timesheet(cfg, day, day, "Sono").splitlines()
    assert csv == ["date,hours,activities", f"{day},0.75,PR review; standup"]
