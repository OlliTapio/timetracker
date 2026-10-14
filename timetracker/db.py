import sqlite3

SCHEMA = """
CREATE TABLE IF NOT EXISTS samples (
    ts REAL NOT NULL,             -- unix seconds
    fg_process TEXT, fg_title TEXT,
    cursor_process TEXT, cursor_title TEXT,
    idle_s REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS samples_ts ON samples(ts);
CREATE TABLE IF NOT EXISTS entries (
    block_start REAL PRIMARY KEY, -- unix seconds, block-aligned
    project TEXT, activity TEXT, confidence REAL, model TEXT, evidence TEXT
);
CREATE TABLE IF NOT EXISTS labels (
    block_start REAL PRIMARY KEY,
    project TEXT NOT NULL, activity TEXT
);
"""


def connect(path: str) -> sqlite3.Connection:
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    return con
