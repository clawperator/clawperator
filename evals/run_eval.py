#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shlex
import shutil
import tempfile
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from evals.harness.agents.base import AgentConfig
from evals.harness.agents.claude import ClaudeAgent
from evals.harness.environment import preflight, resolve_inputs
from evals.harness.runner import build_prompt, run_eval, _prepare_clawperator_launcher


SUPPORTED_AGENTS = {"claude": ClaudeAgent}
SUPPORTED_MODES = {"public-surface", "full-repo"}
SUPPORTED_RUNTIMES = {"local-dev", "published"}


def _load_spec(eval_id: str) -> dict:
    spec_path = ROOT / "evals" / "specs" / eval_id / "spec.json"
    if not spec_path.exists():
        raise SystemExit(f"unknown eval: {eval_id}")
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    spec["spec_dir"] = str(spec_path.parent)
    return spec


def _make_agent(agent_name: str, model: str, knowledge_mode: str) -> ClaudeAgent:
    agent_cls = SUPPORTED_AGENTS.get(agent_name)
    if agent_cls is None:
        raise SystemExit(f"unsupported agent: {agent_name}")
    config = AgentConfig(type_id=agent_name, model=model, knowledge_mode=knowledge_mode)
    return agent_cls(config)


def _model_shorthand(agent_type: str, model: str) -> str:
    prefix = f"{agent_type}-"
    if model.startswith(prefix):
        remainder = model[len(prefix):]
        return remainder.split("-", 1)[0]
    return model.split("-", 1)[0]


def _render_dry_run(
    *,
    resolved_config: dict,
    prompt_path: Path,
    prompt_sha256: str,
    command: list[str],
    work_dir: str,
    env_overrides: dict,
    prompt_text: str,
) -> None:
    print("resolved config:")
    print(json.dumps(resolved_config, indent=2, sort_keys=False))
    print(f"prompt file path: {prompt_path}")
    print(f"prompt sha256: {prompt_sha256}")
    print("exact agent command:")
    print(json.dumps(command, indent=2))
    print(f"work dir: {work_dir}")
    print("env overrides:")
    print(json.dumps(env_overrides, indent=2, sort_keys=False))
    print("substituted prompt text:")
    print(prompt_text)


def _minimal_base_env() -> dict[str, str]:
    return {
        "PATH": os.environ["PATH"],
        "HOME": os.environ["HOME"],
        "LANG": os.environ.get("LANG", "C.UTF-8"),
        "LC_ALL": os.environ.get("LC_ALL", "C.UTF-8"),
    }


def _sanitize_env_overrides(env_overrides: dict[str, str]) -> dict[str, str]:
    redacted: dict[str, str] = {}
    for key, value in env_overrides.items():
        if any(token in key.upper() for token in ("KEY", "SECRET", "TOKEN", "PASSWORD")):
            redacted[key] = "[REDACTED]"
        else:
            redacted[key] = value
    return redacted


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="evals/run_eval.py")
    parser.add_argument("eval_id")
    parser.add_argument("--agent", required=True, choices=sorted(SUPPORTED_AGENTS))
    parser.add_argument("--model", required=True)
    parser.add_argument("--device")
    parser.add_argument("--mode", default="public-surface", choices=sorted(SUPPORTED_MODES))
    parser.add_argument("--runtime", default="local-dev", choices=sorted(SUPPORTED_RUNTIMES))
    parser.add_argument("--timeout-s", type=int, default=300)
    parser.add_argument("--max-turns", type=int, default=40)
    parser.add_argument("--label")
    parser.add_argument("--runs-dir", default=str(ROOT / "evals" / "runs"))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--rescore", nargs="?", const="")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.mode == "full-repo":
        raise SystemExit("full-repo mode is not yet implemented (Phase 3)")
    if args.runtime == "published":
        raise SystemExit("published runtime is not yet implemented (Phase 3)")
    if args.rescore is not None:
        raise SystemExit("rescore is not yet implemented (Phase 2)")
    if args.eval_id != "android-version":
        raise SystemExit(f"unsupported eval: {args.eval_id}")

    spec = _load_spec(args.eval_id)
    spec["runtime_target"] = args.runtime

    agent = _make_agent(args.agent, args.model, args.mode)
    resolved_config = {
        "eval_id": args.eval_id,
        "agent": {
            "type": args.agent,
            "model": args.model,
            "knowledge_mode": args.mode,
        },
        "runtime_target": args.runtime,
        "device_serial": None,
        "timeout_s": args.timeout_s,
        "max_turns": args.max_turns,
        "label": args.label,
        "runs_dir": "<redacted>",
    }

    if args.dry_run:
        try:
            inputs = resolve_inputs(args.device)
        except EnvironmentError as exc:
            print(str(exc), file=sys.stderr)
            return 1
        resolved_config["device_serial"] = inputs.device_serial
        dry_run_work_dir = Path(tempfile.mkdtemp(prefix="clawperator-eval-"))
        display_clawperator_cmd, path_prefix = _prepare_clawperator_launcher(dry_run_work_dir, inputs.clawperator_cmd, args.mode)
        resolved_config["clawperator_cmd"] = display_clawperator_cmd
        resolved_config["operator_package"] = inputs.operator_package
        prompt_path = ROOT / "evals" / "specs" / args.eval_id / spec["prompts"][args.mode]
        prompt_text = build_prompt(
            str(prompt_path),
            {
                "CLAWPERATOR_CMD": shlex.join(display_clawperator_cmd),
                "CLAWPERATOR_OPERATOR_PACKAGE": inputs.operator_package,
                "DEVICE_SERIAL": inputs.device_serial,
                "DOCS_URL": "https://docs.clawperator.com",
            },
        )
        prompt_sha256 = hashlib.sha256(prompt_text.encode("utf-8")).hexdigest()
        command = agent.build_command(prompt_text, str(dry_run_work_dir))
        base_env = _minimal_base_env()
        if path_prefix is not None:
            base_env["PATH"] = f"{path_prefix}{os.pathsep}{base_env['PATH']}"
        env_overrides = _sanitize_env_overrides({
            "ANDROID_SERIAL": inputs.device_serial,
            "CLAWPERATOR_CMD": shlex.join(display_clawperator_cmd),
            "CLAWPERATOR_OPERATOR_PACKAGE": inputs.operator_package,
            **({"EVAL_LABEL": args.label} if args.label is not None else {}),
            **agent.build_env({
                **base_env,
                "ANDROID_SERIAL": inputs.device_serial,
                "CLAWPERATOR_CMD": shlex.join(display_clawperator_cmd),
                "CLAWPERATOR_OPERATOR_PACKAGE": inputs.operator_package,
            }),
        })
        try:
            _render_dry_run(
                resolved_config=resolved_config,
                prompt_path=prompt_path,
                prompt_sha256=prompt_sha256,
                command=command,
                work_dir="<tempdir>",
                env_overrides=env_overrides,
                prompt_text=prompt_text,
            )
        finally:
            shutil.rmtree(dry_run_work_dir, ignore_errors=True)
        return 0

    try:
        env = preflight(args.device)
    except EnvironmentError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    run_dir = run_eval(
        spec=spec,
        env=env,
        agent=agent,
        knowledge_mode=args.mode,
        timeout_s=args.timeout_s,
        runs_dir=Path(args.runs_dir),
        label=args.label,
        max_turns=args.max_turns,
    )

    result = json.loads((run_dir / "result.json").read_text(encoding="utf-8"))
    status = result["outcome"]["status"].upper()
    answer = result["outcome"]["answer_normalized"] or "none"
    duration = result["metrics"]["wall_clock_s"]
    print(run_dir)
    print(f"{status} | {args.agent}/{_model_shorthand(args.agent, args.model)} | {duration:.1f}s | answer={answer}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
