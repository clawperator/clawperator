from __future__ import annotations

from datetime import datetime, timezone

from evals.harness import artifacts


class _FixedDateTime:
    @staticmethod
    def now(tz=None):
        return datetime(2026, 3, 28, 14, 30, 22, 123456, tzinfo=timezone.utc)


class _FixedUuid:
    def __init__(self, value: str):
        self.hex = value


def test_make_run_id_includes_entropy_suffix(monkeypatch):
    monkeypatch.setattr(artifacts, "datetime", _FixedDateTime)
    uuids = iter([_FixedUuid("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), _FixedUuid("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")])
    monkeypatch.setattr(artifacts, "uuid4", lambda: next(uuids))

    first = artifacts.make_run_id("android-version", "claude", "claude-sonnet-4-6", timezone_name="UTC")
    second = artifacts.make_run_id("android-version", "claude", "claude-sonnet-4-6", timezone_name="UTC")

    assert first != second
    assert first.startswith("android-version-20260328-143022-123-aaaaaa-claude-")
    assert second.startswith("android-version-20260328-143022-123-bbbbbb-claude-")


def test_make_run_id_appends_label_slug(monkeypatch):
    monkeypatch.setattr(artifacts, "datetime", _FixedDateTime)
    monkeypatch.setattr(artifacts, "uuid4", lambda: _FixedUuid("cccccccccccccccccccccccccccccccc"))

    run_id = artifacts.make_run_id("android-version", "claude", "claude-sonnet-4-6", "baseline run", timezone_name="UTC")

    assert run_id.endswith("-baseline-run")
