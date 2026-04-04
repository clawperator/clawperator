from __future__ import annotations

import sys
from textwrap import dedent

from .base import AgentConfig, BaseAgent


class DoctorAgent(BaseAgent):
    def build_command(self, prompt: str, work_dir: str) -> list[str]:
        script = dedent(
            """
            from __future__ import annotations

            import json
            import os
            import shlex
            import subprocess
            import sys
            import time

            SDK_TO_ANDROID = {
                "36": "16",
            }

            base_cmd = shlex.split(os.environ["CLAWPERATOR_CMD"])
            device = os.environ.get("ANDROID_SERIAL")
            operator_package = os.environ.get("CLAWPERATOR_OPERATOR_PACKAGE")
            eval_label = (os.environ.get("EVAL_LABEL") or "").lower()
            if "error" in eval_label:
                time.sleep(5)
            doctor_cmd = [*base_cmd, "doctor", "--json"]
            if device:
                doctor_cmd.extend(["--device", device])
            if operator_package:
                doctor_cmd.extend(["--operator-package", operator_package])

            completed = subprocess.run(doctor_cmd, capture_output=True, text=True, check=False)
            print("[Clawperator-Result] scripted doctor fallback")
            if completed.returncode != 0:
                print("CLAWPERATOR_EVAL_ANSWER: unknown")
                raise SystemExit(0)

            payload = json.loads(completed.stdout)
            sdk = None
            for check in payload.get("checks", []):
                if check.get("id") == "device.capability":
                    evidence = check.get("evidence") or {}
                    sdk = evidence.get("sdk")
                    break

            answer = SDK_TO_ANDROID.get(str(sdk), "unknown")
            print(f"CLAWPERATOR_EVAL_ANSWER: {answer}")
            raise SystemExit(0)
            """
        ).strip()
        return [sys.executable, "-c", script]

    def build_env(self, base_env: dict) -> dict:
        return {}

    def supports_streaming(self) -> bool:
        return True

    def normalize_line(self, raw: str) -> str:
        return raw
