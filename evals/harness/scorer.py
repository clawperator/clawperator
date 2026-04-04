from __future__ import annotations

from dataclasses import dataclass
import re


ANSWER_PATTERN = re.compile(r"^CLAWPERATOR_EVAL_ANSWER:\s*(\S.*?)\s*$", re.MULTILINE)
_ANSI_PATTERN = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
_DISALLOWED_TOOL_PATTERN = re.compile(r"^(?:\$|>)\s+adb\s+shell\b", re.MULTILINE | re.IGNORECASE)


def normalize_version(v: str) -> str:
    v = v.strip().lower()
    if v.startswith("android "):
        v = v[len("android "):].strip()
    match = re.search(r"\d+", v)
    return match.group(0) if match else v


def extract_answer(transcript: str) -> str | None:
    matches = ANSWER_PATTERN.findall(transcript)
    return matches[-1] if matches else None


def detect_disallowed_tool(transcript: str) -> bool:
    cleaned = _ANSI_PATTERN.sub("", transcript)
    return _DISALLOWED_TOOL_PATTERN.search(cleaned) is not None


@dataclass
class ScorerResult:
    answer_extracted_raw: str | None
    answer_normalized: str | None
    ground_truth_normalized: str
    answer_correct: bool
    used_disallowed_tool: bool


def score(transcript: str, ground_truth: str, answer_extracted_raw: str | None = None) -> ScorerResult:
    raw_answer = answer_extracted_raw if answer_extracted_raw is not None else extract_answer(transcript)
    answer_normalized = normalize_version(raw_answer) if raw_answer is not None else None
    ground_truth_normalized = normalize_version(ground_truth)
    answer_correct = answer_normalized is not None and answer_normalized == ground_truth_normalized
    return ScorerResult(
        answer_extracted_raw=raw_answer,
        answer_normalized=answer_normalized,
        ground_truth_normalized=ground_truth_normalized,
        answer_correct=answer_correct,
        used_disallowed_tool=detect_disallowed_tool(transcript),
    )
