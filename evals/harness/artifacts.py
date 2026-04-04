from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


_TRANSCRIPT_CAP_BYTES = 10 * 1024 * 1024


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return re.sub(r"-+", "-", slug).strip("-")


def make_run_id(eval_id: str, agent_type: str, model: str, label: str | None = None) -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")[:-3]
    entropy = uuid4().hex[:6]
    model_short = model.lower()[:12]
    parts = [eval_id, timestamp, entropy, agent_type, model_short]
    if label is not None:
        slug = _slugify(label)
        if slug:
            parts.append(slug)
    return "-".join(parts)


def _encode_transcript(transcript: str) -> bytes:
    data = transcript.encode("utf-8")
    if len(data) <= _TRANSCRIPT_CAP_BYTES:
        return data
    truncated = data[:_TRANSCRIPT_CAP_BYTES]
    while True:
        try:
            text = truncated.decode("utf-8")
            break
        except UnicodeDecodeError as exc:
            truncated = truncated[: exc.start]
    return f"{text}\n[TRANSCRIPT_TRUNCATED]\n".encode("utf-8")


def _write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")


def write_run(
    run_dir: Path,
    result: dict,
    config: dict,
    transcript: str,
) -> None:
    run_dir.mkdir(parents=True, exist_ok=True)
    result_path = run_dir / "result.json"
    config_path = run_dir / "config.json"
    transcript_path = run_dir / "transcript.txt"
    if result_path.exists() or config_path.exists():
        raise FileExistsError(f"run artifacts already exist in {run_dir}")
    _write_json(result_path, result)
    _write_json(config_path, config)
    transcript_path.write_bytes(_encode_transcript(transcript))
