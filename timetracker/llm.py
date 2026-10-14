"""Label one block with a small local model served by Ollama (can run on another PC on the LAN)."""
import json
import urllib.request

SYSTEM = """You write time-tracking entries. Given what was on screen during one {minutes}-minute \
block, pick the project the person mostly worked on and describe the activity in under 10 words.
Projects: {projects}. Use "Idle" if they were mostly away.
Focused windows are where typing went; cursor-only windows are usually reading.
Answer as JSON: {{"project": ..., "activity": ..., "confidence": 0-1}}"""


def build_messages(evidence_text: str, projects: list[str], minutes: int, examples=()) -> list[dict]:
    msgs = [{"role": "system", "content": SYSTEM.format(
        minutes=minutes, projects=", ".join(projects + ["Idle"]))}]
    for ev_text, label in examples:  # corrected past blocks as few-shot examples
        msgs += [{"role": "user", "content": ev_text},
                 {"role": "assistant", "content": json.dumps(label)}]
    msgs.append({"role": "user", "content": evidence_text})
    return msgs


def parse(content: str, projects: list[str]) -> dict:
    try:
        out = json.loads(content)
    except json.JSONDecodeError:
        return {"project": "Unknown", "activity": content[:80], "confidence": 0.0}
    if out.get("project") not in projects + ["Idle"]:
        out["project"] = "Unknown"
    out.setdefault("activity", "")
    out["confidence"] = float(out.get("confidence") or 0.0)
    return out


def label(url: str, model: str, messages: list[dict], timeout: float = 120) -> str:
    body = json.dumps({"model": model, "messages": messages, "format": "json",
                       "stream": False, "options": {"temperature": 0}}).encode()
    req = urllib.request.Request(f"{url}/api/chat", body, {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())["message"]["content"]
