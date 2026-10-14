import tomllib
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Config:
    projects: list[str] = field(default_factory=lambda: ["Work", "Personal", "Break"])
    db_path: str = "timetracker.db"
    sample_seconds: float = 5.0
    idle_after_seconds: float = 120.0
    block_minutes: int = 15
    ollama_url: str = "http://localhost:11434"
    model: str = "qwen2.5:7b-instruct"
    redact: list[str] = field(default_factory=list)  # regexes removed from titles before storage


def load(path: str | Path = "config.toml") -> Config:
    p = Path(path)
    if not p.exists():
        return Config()
    data = tomllib.loads(p.read_text(encoding="utf-8"))
    return Config(**data)
