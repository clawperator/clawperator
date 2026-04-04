# Eval Phase 1 Work Breakdown

Parent plan: `tasks/evals/phase-1/plan.md`

## Executive Summary

1 PR, 4 sub-phases. All ship together. Sub-phases are sequenced; do not
start the next until the current one passes its acceptance criteria.

| Sub-phase | Purpose | Agent tier | Kimi flags |
| --- | --- | --- | --- |
| 1a | Directory scaffold + gitignore | fast | `--no-thinking --print --yolo` |
| 1b | Harness core (environment, runner, scorer, artifacts, claude adapter) | thinking | `--thinking --print --yolo` |
| 1c | Eval spec + prompt + run_eval.py CLI + README | default | `--print --yolo` |
| 1d | Validation: 1 passing run + 1 error run + dry-run | default | `--print --yolo` |

**Implementing agent:** Kimi (`kimi` CLI v1.27.0). See `tasks/evals/plan.md`
"Implementing Agent" section for invocation reference, model name, and flag
mapping. Model must be `kimi-code/kimi-for-coding` (short names do not work).

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total sub-phases | 4 (1a-1d) |
| Completed | none |
| Remaining | 1a, 1b, 1c, 1d |
| Current / Next | 1a |
| Blockers | none |

## Hard Rules

1. Do not skip any sub-phase. 1a through 1d must all pass before committing
   the PR.
2. Build the Node CLI before any device interaction:
   `npm --prefix apps/node run build`. Never test against stale `dist/`.
3. Use the branch-local CLI for all device operations. The preflight will
   auto-detect the local build at `<repo_root>/apps/node/dist/cli/index.js`
   and set `clawperator_cmd = ["node", "<abs_path>"]` when CLAWPERATOR_BIN is
   not set. There is no CLAWPERATOR_SCRIPT env var - do not reference it.
4. Use the `.dev` Operator APK for all local testing:
   `CLAWPERATOR_OPERATOR_PACKAGE="com.clawperator.operator.dev"`.
5. Do not hard-code device serials anywhere. Always use `--device <serial>`
   or the `ANDROID_SERIAL` env var.
6. Agent working directory for `public-surface` mode must be a clean
   `tempfile.mkdtemp()`. Never the repo root.
7. Do not store the full inherited environment in `config.json`. Store only
   the `env_overrides` dict (ANDROID_SERIAL, CLAWPERATOR_CMD,
   CLAWPERATOR_OPERATOR_PACKAGE, and agent API key names) and lightweight
   reproducibility anchors: Python version, platform, cwd, agent binary
   version, and an env hash. **Redact API key values** in `config.json`:
   any env var whose name contains "KEY", "SECRET", "TOKEN", or "PASSWORD"
   must be stored as `"[REDACTED]"` (not the actual value). The logger's
   SPAWN event must apply the same redaction. Note: Kimi uses OAuth stored
   credentials in `~/.kimi/`, not env-var API keys, so there is nothing to
   redact for Kimi runs. Other agents (Claude, Gemini, Codex) do use env-var
   API keys.
8. The harness must never write to `evals/runs/` inside the repo without
   creating the directory first (it is gitignored, so it may not exist).
9. One commit per sub-phase. Do not batch 1a+1b into one commit.
10. Update `tasks/evals/phase-1/plan.md` Status section after each sub-phase.
11. If a sub-phase acceptance check fails, fix it before moving on.
12. Never shorten `Clawperator` to `Claw` in code, docs, or comments.
13. Do not add AI attribution lines to commit messages.
14. `--max-turns` is accepted by `run_eval.py` in Phase 1 but must have no
    effect on harness behavior. It is recorded in `config.json` only.
15. Answer scoring must normalize both sides. Normalization order: strip
    whitespace, lowercase, strip leading `android ` prefix, then extract the
    first digit run if one exists. If no digits exist, compare the trimmed
    lowercase string. Never compare raw strings. See `normalize_version`
    spec below.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| Order | File | Why it matters |
| --- | --- | --- |
| 1 | `tasks/evals/plan.md` | Overarching design: axes, result schema, agent CLI flags |
| 2 | `tasks/evals/phase-1/plan.md` | Phase scope, decision rules, acceptance criteria |
| 3 | `CLAUDE.md` | Repo rules, device selection rules, validation commands |
| 4 | `apps/node/src/contracts/result.ts` | Result envelope shape (for `[Clawperator-Result]` detection) |
| 5 | `apps/node/src/contracts/errors.ts` | Error codes (doctor pre-flight may emit these) |
| 6 | `apps/node/src/cli/registry.ts` | Verify `doctor` command name and flags |
| 7 | `.agents/skills/test-recording-validate/runs/20260319-134606/result.json` (if present) | Exemplar run artifact shape from existing skill |

## PR / Phase Plan

| PR | Purpose | Included sub-phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Complete Phase 1 harness | 1a, 1b, 1c, 1d | fast/thinking/default/default | 1 passing run; 1 error run; dry-run exits 0; `evals/runs/` gitignored |

---

## Sub-phase 1a: Directory Scaffold

### Agent Tier

fast

### Goal

Create the `evals/` directory structure with empty package files and gitignore.
No logic yet.

### Files or Surfaces To Change

- `evals/.gitignore`
- `evals/harness/__init__.py`
- `evals/harness/agents/__init__.py`
- `evals/specs/android-version/` (empty directory, created for 1c)
- `.gitignore` (repo root, one line added)

### Steps

1. Create `evals/` directory tree:
   ```
   evals/
   ├── harness/
   │   ├── agents/
   ```
2. Create `evals/.gitignore`:
   ```
   runs/
   __pycache__/
   *.pyc
   .pytest_cache/
   ```
3. Create empty `evals/harness/__init__.py` and `evals/harness/agents/__init__.py`.
4. Add to repo root `.gitignore` (append after the existing `tmp/` entry):
   ```
   evals/runs/
   ```
5. Verify `evals/runs/` is gitignored:
   ```bash
   mkdir -p evals/runs/test && git status evals/runs/
   # Should show nothing tracked under evals/runs/
   rmdir evals/runs/test
   ```

### Acceptance Criteria

- `evals/harness/__init__.py` exists and is empty.
- `evals/harness/agents/__init__.py` exists and is empty.
- `evals/.gitignore` contains `runs/`.
- `git check-ignore evals/runs/` returns `evals/runs/`.

### Validation

```bash
git check-ignore -v evals/runs/
```

### Expected Commit

```
chore(evals): scaffold evals/ directory structure
```

---

## Sub-phase 1b: Harness Core

### Agent Tier

thinking

### Goal

Implement the five harness modules: `environment.py`, `runner.py`, `scorer.py`,
`artifacts.py`, and `agents/` (base + Claude adapter). No eval spec yet; no
CLI entry point yet. Focus on correctness of each component in isolation.

### Files or Surfaces To Change

- `evals/harness/environment.py`
- `evals/harness/runner.py`
- `evals/harness/scorer.py`
- `evals/harness/artifacts.py`
- `evals/harness/logger.py`
- `evals/harness/agents/base.py`
- `evals/harness/agents/claude.py`

### Component Specifications

#### `environment.py`

```python
@dataclass
class Environment:
    device_serial: str
    ground_truth_android_version: str
    ground_truth_collected_at: str
    clawperator_cmd: list[str]   # e.g. ["node", "/path/to/dist/cli/index.js"]
                                  # or ["clawperator"] for published runtime
    clawperator_version: str
    operator_package: str

def preflight(device: str | None) -> Environment:
    """
    1. Verify adb is on PATH.
    2. Run `adb devices`. Extract authorized devices.
    3. If device is specified, verify it is in the authorized list.
       If not specified and exactly one authorized device exists, use it.
       If not specified and multiple devices exist, raise with helpful message.
    4. Resolve clawperator_cmd using this three-tier order (mirrors
       `apps/node/src/domain/skills/skillsConfig.ts` `resolveSkillBin()`):
       a. If CLAWPERATOR_BIN env var is set and non-empty: use it as the
          executable. Set `clawperator_cmd = [bin]`.
          NOTE: there is no CLAWPERATOR_SCRIPT env var. Do not invent one.
          If the user wants `node /path/to/index.js`, they should either:
          - Not set CLAWPERATOR_BIN (let step b auto-detect), or
          - Set CLAWPERATOR_BIN to the full path of a standalone binary.
          Setting CLAWPERATOR_BIN=node alone is NOT useful (produces
          `["node"]` with no script - same behavior as the real
          `resolveSkillBin()` which returns `{cmd: explicitBin, args: []}`).
       b. If CLAWPERATOR_BIN is not set: check whether the local build exists
          at `<repo_root>/apps/node/dist/cli/index.js`. If the file exists,
          set `clawperator_cmd = ['node', '<abs_path>']`. Use the absolute
          path, not a relative one. Resolve `<repo_root>` via
          `git rev-parse --show-toplevel` or `Path(__file__).resolve().parents[N]`
          at import time.
       c. If the local build does not exist: check `shutil.which('clawperator')`.
          If found, set `clawperator_cmd = ['clawperator']`.
       d. If none of the above resolves: raise EnvironmentError with a clear
          message listing all three paths that were checked and found missing.
       This order matches the documented resolution order in
       `apps/node/src/domain/skills/skillsConfig.ts`:
       explicit CLAWPERATOR_BIN > local sibling build > global binary.
    5. Verify: `shutil.which(env.clawperator_cmd[0])` is not None.
       If None, raise EnvironmentError.
       For the selected agent adapter, also verify the agent executable exists
       up front. If it cannot be resolved, raise EnvironmentError("agent_binary_not_found")
       before any device interaction.
    6. Resolve CLAWPERATOR_OPERATOR_PACKAGE: env var > "com.clawperator.operator.dev"
    7. Run `env.clawperator_cmd + ['doctor', '--json']` with ANDROID_SERIAL set.
       If exit code != 0, raise EnvironmentError("doctor_preflight_failed").
    8. Run `adb -s <serial> shell getprop ro.build.version.release`.
       Strip whitespace. Reject empty result. Record the timestamp used for
       collection in `ground_truth_collected_at`.
    9. Run `env.clawperator_cmd + ['version']` to capture clawperator_version.
       The version command outputs JSON by default (e.g. `{"cliVersion":"0.5.3"}`).
       Parse the JSON output and extract the `cliVersion` field. There is no
       `--json` flag on the version command; JSON is the default output format.
    10. Return Environment dataclass.
    """
```

Use `subprocess.run` with `check=False` for all subprocess calls. Check return
codes explicitly. Never use shell=True with user-provided values.

#### `scorer.py`

```python
def normalize_version(v: str) -> str:
    """
    Normalize a version string for comparison. Steps in order:
    1. Strip leading and trailing whitespace.
    2. Lowercase.
    3. Strip leading 'android ' prefix if present (handles 'Android 15' -> '15').
    4. Strip whitespace again (handles 'android  15' with extra internal space).
    """
    v = v.strip().lower()
    if v.startswith("android "):
        v = v[len("android "):].strip()
    match = re.search(r"\d+", v)
    return match.group(0) if match else v

ANSWER_PATTERN = re.compile(
    r'^CLAWPERATOR_EVAL_ANSWER:\s*(\S.*?)\s*$',
    re.MULTILINE
)

def extract_answer(transcript: str) -> str | None:
    """
    Scan transcript for CLAWPERATOR_EVAL_ANSWER: <value>.
    Uses ANSWER_PATTERN (re.MULTILINE so ^ and $ match line boundaries).
    Rules:
    - The marker must appear at the START of a line. A marker embedded inside
      a JSON value or code block will NOT match. This is intentional - it keeps
      matching deterministic and avoids false positives from tool output.
    - Requires at least one non-whitespace character after the colon.
      A line like 'CLAWPERATOR_EVAL_ANSWER:' (nothing after colon) or
      'CLAWPERATOR_EVAL_ANSWER:   ' (whitespace only) does NOT match.
    - Multi-word answers ARE captured. 'CLAWPERATOR_EVAL_ANSWER: Android 15'
      captures 'Android 15'. The scorer's normalize_version() handles reduction
      to the canonical form.
    - Last match in the transcript wins (agent may revise its answer).
    - The captured value is trimmed of leading/trailing whitespace.
    Returns None if no valid match found.
    """
    matches = ANSWER_PATTERN.findall(transcript)
    return matches[-1] if matches else None

def detect_disallowed_tool(transcript: str) -> bool:
    """
    Return True if the transcript contains evidence of the agent directly
    invoking adb shell (not Clawperator's own output).
    Use a conservative pattern - false negatives are acceptable in Phase 1.
    See Open Questions in plan.md for pattern guidance.
    """

@dataclass
class ScorerResult:
    answer_extracted_raw: str | None
    answer_normalized: str | None
    ground_truth_normalized: str
    answer_correct: bool
    used_disallowed_tool: bool

def score(transcript: str, ground_truth: str) -> ScorerResult:
    """Extract answer, normalize both sides, compare, return ScorerResult."""
```

#### `artifacts.py`

```python
def make_run_id(eval_id: str, agent_type: str, model: str, label: str | None = None) -> str:
    """
    Format: <eval_id>-<YYYYMMDD-HHMMSS>-<agent_type>-<model_short>[-<label_slug>]
    model_short: first 12 chars of model, lowercased, hyphens preserved.
    label_slug: optional, filesystem-safe lowercase label suffix.
    """

def write_run(
    run_dir: Path,
    result: dict,      # result.json content
    config: dict,      # config.json content (includes invocation.command, run_label,
                       # and reproducibility anchors)
    transcript: str,
) -> None:
    """
    Create run_dir. Write result.json, config.json, transcript.txt.
    Do not overwrite an existing run_dir - raise if it already exists.
    Transcript is capped at 10MB. If truncated, append [TRANSCRIPT_TRUNCATED].
    """
```

#### `logger.py`

```python
"""
Lightweight structured logger for the eval harness.
Writes to stderr (for operator visibility) and to a harness.log file in the run dir.
All log entries are timestamped and prefixed with the run_id once it is known.

Required log events (at minimum):
- SPAWN: the exact command list, work_dir, env_overrides dict (sanitized: redact any key
  containing "KEY", "SECRET", "TOKEN", "PASSWORD")
- ENV_SUMMARY: device_serial, clawperator_cmd, operator_package, clawperator_version
- STATE: runner transitions - "starting", "agent_spawned", "answer_found", "timeout_triggered",
         "sigterm_sent", "sigkill_sent", "completed"
- TIMEOUT: wall_clock_s elapsed when timeout fires
- KILL: which signal was sent and to which pgid
- SCORE: outcome.status, answer_normalized (or "no_answer"), and violations.used_adb
- VIOLATION: diagnostic-only adb-shell detection evidence and whether it matched
- ERROR: any EnvironmentError or unexpected exception, with traceback
- RESULT: final one-line human-readable summary written as the last log entry.
  Format: "RESULT: <status> | answer=<normalized_or_none> | truth=<ground_truth> | turns=<n_or_null> | time=<wall_clock_s>s"
  Example: "RESULT: pass | answer=15 | truth=15 | turns=null | time=87.4s"
  This line makes run inspection fast - a developer tailing harness.log sees the
  outcome immediately without opening result.json.

Format: single-line JSON per event, written to stderr and appended to harness.log.
Exception: the RESULT event is written as a plain text line (not JSON) for human readability.
JSON example: {"ts": "2026-03-28T14:30:01Z", "run_id": "android-version-...", "event": "SPAWN", "cmd": [...], ...}
"""

def get_logger(run_id: str, log_file: Path | None = None) -> HarnessLogger:
    """Return a logger bound to this run_id. If log_file is None, log to stderr only."""
```

#### `agents/base.py`

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

@dataclass
class AgentConfig:
    type_id: str
    model: str
    knowledge_mode: str   # "public-surface" | "full-repo"
    extra_flags: list[str] = field(default_factory=list)

class BaseAgent(ABC):
    def __init__(self, config: AgentConfig): ...

    @abstractmethod
    def build_command(self, prompt: str, work_dir: str) -> list[str]:
        """Return the exact subprocess argv list."""

    @abstractmethod
    def build_env(self, base_env: dict) -> dict:
        """
        Return env overrides for this agent (not the full environment).
        CRITICAL: The harness builds a minimal env whitelist (PATH, HOME, LANG,
        LC_ALL, ANDROID_SERIAL, CLAWPERATOR_*). Agent API keys (e.g.
        ANTHROPIC_API_KEY, GOOGLE_API_KEY, OPENAI_API_KEY) are NOT included in
        the base env. Each adapter MUST forward its required API key(s) from
        os.environ in this method, or the agent subprocess will fail to
        authenticate.
        """

    @abstractmethod
    def supports_streaming(self) -> bool:
        """
        Return True if the harness should attempt in-flight answer scanning
        line-by-line during execution. False means the harness defers answer
        scanning until after the process exits.
        This does NOT guarantee the CLI itself flushes output promptly - some
        CLIs claim to stream but buffer in practice. The flag controls harness
        behavior, not CLI behavior.
        Codex and similar tools that buffer all output until exit should return False.
        """

    @abstractmethod
    def normalize_line(self, raw: str) -> str:
        """
        Pre-process a raw output line before transcript writing and answer scanning.
        Default implementation returns the line unchanged.
        Adapters may use this to strip ANSI codes, progress spinners, or log prefixes
        that appear in the agent's output but pollute the transcript.
        """
```

No `count_turn` method in Phase 1. It is added in Phase 2.

#### `agents/claude.py`

```python
class ClaudeAgent(BaseAgent):
    def build_command(self, prompt: str, work_dir: str) -> list[str]:
        cmd = [
            "claude",
            "-p", prompt,
            "--model", self.config.model,
            "--dangerously-skip-permissions",
            "--output-format", "stream-json",
        ]
        cmd.extend(self.config.extra_flags)
        return cmd

    def build_env(self, base_env: dict) -> dict:
        # Claude Code needs its API key to function. Forward it from the
        # parent env if present. The harness uses a minimal env whitelist,
        # so agent-specific keys must be explicitly injected here.
        env = {}
        for key in ["ANTHROPIC_API_KEY"]:
            val = os.environ.get(key)
            if val is not None:
                env[key] = val
        return env

    def supports_streaming(self) -> bool:
        return True  # Claude streams stream-json lines incrementally

    def normalize_line(self, raw: str) -> str:
        return raw   # Claude output needs no normalization
```

Note for Phase 2 work-breakdown: Codex should return `supports_streaming() -> False` since it
buffers output.

#### `runner.py`

```python
def run_eval(
    spec: dict,
    env: Environment,
    agent: BaseAgent,
    knowledge_mode: str,
    timeout_s: int,
    runs_dir: Path,
    label: str | None = None,
    max_turns: int | None = None,  # accepted but not used in Phase 1
) -> Path:
    """
    0a. Send `adb -s <device_serial> shell input keyevent KEYCODE_WAKEUP` (wake screen).
    0b. Send `adb -s <device_serial> shell input keyevent KEYCODE_HOME` (navigate to Home).
        Sleep 0.5s to allow Home to settle.
        If either keyevent command fails (non-zero exit or adb error), log a WARNING-level
        harness event but do NOT abort. The doctor pre-flight and the first Clawperator
        command issued by the agent are the definitive device-health gates. WAKEUP on an
        already-awake device is usually a no-op, but can behave inconsistently on some
        emulators - treat failure as advisory, not fatal.
    1. Build prompt through a single function contract:
       build_prompt(template_path: str, variables: dict) -> str
       Variables are explicit and injected once:
       - CLAWPERATOR_CMD (use shlex.join(env.clawperator_cmd) for shell-safe use)
       - CLAWPERATOR_OPERATOR_PACKAGE
       - DEVICE_SERIAL
       - DOCS_URL (hardcoded to "https://docs.clawperator.com")
       Note: CLAWPERATOR_BIN is NOT a prompt variable. It is a preflight input
       only. The agent receives CLAWPERATOR_CMD (the resolved command string).
       No implicit string replacement or ad hoc formatting.
       Prompt instructs the agent: "Execute Clawperator commands exactly as
       shell commands using the provided base command. Do not reinterpret or
       rewrite the command structure."
    2. Compute prompt_sha256.
    3. Create work_dir:
       - public-surface: tempfile.mkdtemp() once per run
       - full-repo: repo root
    4. Check for CLAUDE.md / context file requirement (see Open Questions).
    5. Build subprocess env:
       # Build a minimal, stable environment instead of inheriting everything.
       # Keep only the standard runtime variables the CLI needs plus the
       # explicit eval variables.
       base = {
           "PATH": os.environ["PATH"],
           "HOME": os.environ["HOME"],
           "LANG": os.environ.get("LANG", "C.UTF-8"),
           "LC_ALL": os.environ.get("LC_ALL", "C.UTF-8"),
           "ANDROID_SERIAL": env.device_serial,
           "CLAWPERATOR_CMD": shlex.join(env.clawperator_cmd),  # logging-safe only
           "CLAWPERATOR_OPERATOR_PACKAGE": env.operator_package,
       }
       # CLAWPERATOR_BIN is accepted as INPUT during preflight only.
       # Not injected into the agent's env - agent receives the full
       # shell-safe CLAWPERATOR_CMD string.
       overrides = agent.build_env(base)
       final_env = {**base, **overrides}
    6. Build command = agent.build_command(prompt, work_dir).
    6a. Compute run_id via artifacts.make_run_id(eval_id, agent.config.type_id, model, label).
    6b. Create run_dir: runs_dir / run_id. Raise if it already exists (idempotency guard).
    6c. Initialize logger: logger = get_logger(run_id, log_file=run_dir / "harness.log").
        From this point all events write to both stderr and harness.log.
    6d. Log ENV_SUMMARY: device_serial, clawperator_cmd, operator_package, clawperator_version.
    7. Record started_at.
    8. Open transcript file for writing at run_dir / "transcript.txt" (before spawning).
    9. Spawn subprocess with Popen, cwd=work_dir, env=final_env,
       stdout=PIPE, stderr=STDOUT, text=True, bufsize=1,
       start_new_session=True. This creates a fresh session and process group
       on POSIX, equivalent to `preexec_fn=os.setsid`.
       Merge stderr into stdout via stderr=STDOUT.
    10. Start a background timer thread (threading.Timer) that sets a
        `timeout_triggered = threading.Event()` and calls the os.killpg
        termination sequence after wall-clock timeout elapses. The timer fires
        regardless of whether the agent writes any output. Before the final
        SIGKILL escalation, flush transcript buffers and close file handles so
        the last lines survive timeout cleanup. The for-loop naturally exits
        when proc.stdout is closed (either by process exit or SIGKILL). After
        the loop, check `timeout_triggered.is_set()` to distinguish natural
        exit from timeout kill.
    11. Read output line by line. Call agent.normalize_line(line) on each line
        before writing to transcript and scanning for the answer marker:
        for line in proc.stdout:           # With text=True, lines are already decoded strings
            line = agent.normalize_line(line)
            transcript_file.write(line)
            transcript_file.flush()
            # Streaming is logging-only. Control flow must never depend on
            # in-flight parsing success.
            # Check for answer marker in-memory on each line. Update last_answer if found.
            # Transcript size cap: once transcript_bytes_written >= 10MB, stop writing
            # further lines to the file. Still continue reading proc.stdout (so the
            # process is not blocked on a full pipe) and still scan for the answer marker.
            # When the cap is hit, append one line: "[TRANSCRIPT_TRUNCATED]"
            # to the file and set a truncated=True flag. Do not append more lines after.
    12. After the loop, check last_answer first, then check
        timeout_triggered.is_set(). An answer found in the last line before
        timeout still wins.
    13. Record finished_at.
    14. Optionally re-read `adb -s <serial> shell getprop ro.build.version.release`
        for logging only. If performed, record `ground_truth_rechecked_at`
        in result.json and emit the observed value to harness.log. Never use
        the re-read for scoring.
    15. Read full transcript. Run scorer.score().
    16. Determine outcome.status using the precedence table in
        tasks/evals/plan.md ## Outcome Precedence. Summary:
        - error > pass > fail > budget_exceeded > timeout > no_answer
        - An answer in the last line before timeout still wins.
        - budget_exceeded only if --max-turns is set and no answer was emitted.
    17. Build result.json and config.json per schema in tasks/evals/plan.md.
        Include the minimal reproducibility anchors from the hard rules.
    18. Write run artifacts via artifacts.write_run().
    19. Log RESULT summary line (plain text, last entry in harness.log):
        logger.result(status, answer_normalized, ground_truth, turns_counted, wall_clock_s)
        This produces: "RESULT: pass | answer=15 | truth=15 | turns=null | time=87.4s"
    20. Clean up temp work_dir if public-surface mode.
    21. Return run dir path.
    """
```

**Timeout termination pattern:**

```python
# Terminate entire process group, not just the parent PID
try:
    os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    time.sleep(5)
    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
except ProcessLookupError:
    pass  # process group already gone

# After kill, verify the process is actually gone
time.sleep(1)
if proc.poll() is None:
    logger.log("WARN", event="kill_incomplete",
               msg="Process still alive after SIGKILL - may have daemonized children")
    # Do not retry. Log and continue. Orphans are the OS's problem.
```

Use `start_new_session=True` in the Popen call to ensure a clean process group
boundary. This prevents child processes (e.g. a subprocess the agent spawned
to call the Clawperator binary) from surviving after the timeout fires.

**IO pattern (replaces the prior polling approach):**

```python
subprocess.Popen(
    cmd,
    cwd=work_dir,
    env=final_env,
    stdout=PIPE,
    stderr=STDOUT,
    text=True,          # decode output as str, not bytes
    bufsize=1,          # line-buffered; essential for real-time streaming
    start_new_session=True,
)
```

- `text=True` - lines come out as str, no manual decode
- `bufsize=1` - line-buffered, ensures each line arrives as soon as the agent writes it;
  prevents long blocking on unbuffered reads
- `stderr=STDOUT` - merge stderr into stdout
- Read line by line in Python: `for line in proc.stdout:` (NOT `raw_line.decode(...)` -
  lines are already strings when `text=True` is set)
- Tee each normalized line immediately to the transcript file as it arrives
- Check for the answer marker in-memory on each line (no file re-read, no polling)
- Transcript file is opened for writing before the loop starts and flushed on each line
- A `threading.Timer` is started immediately after Popen. It sets a
  `timeout_triggered = threading.Event()` and calls the `os.killpg` termination
  sequence. The for-loop naturally exits when proc.stdout is closed (either by process
  exit or SIGKILL). After the loop, check `timeout_triggered.is_set()` to distinguish
  natural exit from timeout kill. This ensures timeout fires even on a completely silent
  agent.

### Steps

1. Implement `environment.py` with the spec above.
2. Implement `scorer.py` with the spec above. Write unit tests for
   `normalize_version` and `extract_answer` in `evals/harness/test_scorer.py`.
3. Implement `artifacts.py` with the spec above.
4. Implement `agents/base.py` and `agents/claude.py` with the spec above.
5. Implement `runner.py` with the spec above.
6. Run the unit tests:
   ```bash
   python -m pytest evals/harness/test_scorer.py -v
   ```
   All tests must pass.

### Unit Test Requirements for `scorer.py`

Write at least these test cases in `evals/harness/test_scorer.py`:

```python
# normalize_version
assert normalize_version("15") == "15"
assert normalize_version("Android 15") == "15"
assert normalize_version("android 15") == "15"
assert normalize_version("  Android 15  ") == "15"
assert normalize_version("14") == "14"

# extract_answer - last occurrence wins
transcript_single = "some output\nCLAWPERATOR_EVAL_ANSWER: 15\nmore output"
assert extract_answer(transcript_single) == "15"

transcript_multi = "CLAWPERATOR_EVAL_ANSWER: 14\nlater...\nCLAWPERATOR_EVAL_ANSWER: 15"
assert extract_answer(transcript_multi) == "15"

transcript_none = "no answer here"
assert extract_answer(transcript_none) is None

# score - pass
result = score("CLAWPERATOR_EVAL_ANSWER: Android 15\n", "15")
assert result.answer_correct is True
assert result.answer_normalized == "15"
assert result.answer_extracted_raw == "Android 15"

# score - fail
result = score("CLAWPERATOR_EVAL_ANSWER: 14\n", "15")
assert result.answer_correct is False

# score - no answer
result = score("no answer", "15")
assert result.answer_correct is False
assert result.answer_extracted_raw is None

# extract_answer - malformed marker (no value after colon)
transcript_malformed = "CLAWPERATOR_EVAL_ANSWER:\n"
assert extract_answer(transcript_malformed) is None

transcript_whitespace_only = "CLAWPERATOR_EVAL_ANSWER:   \n"
assert extract_answer(transcript_whitespace_only) is None

# extract_answer - marker inside JSON blob does NOT match (marker must be at line start)
transcript_inside_json = '{"output": "CLAWPERATOR_EVAL_ANSWER: 15"}'
assert extract_answer(transcript_inside_json) is None

# extract_answer - marker at line start inside a multiline string does match
transcript_linestart = 'some output\nCLAWPERATOR_EVAL_ANSWER: 15\nmore output'
assert extract_answer(transcript_linestart) == "15"

# extract_answer - multi-word answer IS captured (normalization handles reduction)
transcript_multiword = 'CLAWPERATOR_EVAL_ANSWER: Android 15\n'
assert extract_answer(transcript_multiword) == "Android 15"

# extract_answer - trailing whitespace is stripped
transcript_trailing = 'CLAWPERATOR_EVAL_ANSWER: 15   \n'
assert extract_answer(transcript_trailing) == "15"
```

### Acceptance Criteria

- All unit tests in `evals/harness/test_scorer.py` pass.
- `from evals.harness.runner import run_eval` imports without error.
- `from evals.harness.agents.claude import ClaudeAgent` imports without error.
- `from evals.harness.environment import preflight` imports without error.
- `from evals.harness.logger import get_logger` imports without error.

### Validation

```bash
python -m pytest evals/harness/test_scorer.py -v
python -c "from evals.harness.runner import run_eval; print('ok')"
python -c "from evals.harness.agents.claude import ClaudeAgent; print('ok')"
python -c "from evals.harness.logger import get_logger; print('ok')"
```

### Expected Commit

```
feat(evals): implement harness core (environment, runner, scorer, artifacts, claude adapter)
```

---

## Sub-phase 1c: Eval Spec, Prompt, CLI, and README

### Agent Tier

default

### Goal

Write the `android-version` eval spec, the public-surface prompt, the
`run_eval.py` CLI entry point, and the `evals/README.md`.

### Files or Surfaces To Change

- `evals/specs/android-version/spec.json`
- `evals/specs/android-version/prompt-public.md`
- `evals/run_eval.py`
- `evals/README.md`
- `docs/internal/design/evals.md`

### Eval Spec

`evals/specs/android-version/spec.json`:

```json
{
  "eval_id": "android-version",
  "name": "Determine Android Version via Settings",
  "description": "Agent must navigate Android Settings using the Clawperator CLI to determine the device Android version.",
  "version": "1.0.0",
  "prompts": {
    "public-surface": "prompt-public.md",
    "full-repo": "prompt-full-repo.md"
  },
  "environment": {
    "requires_device": true,
    "requires_clawperator_doctor": true,
    "requires_settings_app": true
  },
  "budget": {
    "default_timeout_s": 300,
    "default_max_turns": 40
  },
  "scoring": {
    "method": "exact_match_normalized",
    "ground_truth_source": "adb_getprop",
    "ground_truth_prop": "ro.build.version.release",
    "answer_marker": "CLAWPERATOR_EVAL_ANSWER"
  }
}
```

### Prompt File

`evals/specs/android-version/prompt-public.md`:

```markdown
You are an autonomous agent with access to a connected Android device via the
Clawperator CLI. Your task is to determine the Android version running on the
device and return it as your final answer.

Environment:
- Clawperator command: $CLAWPERATOR_CMD
- Operator package: $CLAWPERATOR_OPERATOR_PACKAGE
- Target device serial: $DEVICE_SERIAL
- Clawperator documentation: $DOCS_URL

Instructions:
1. Open Android Settings using the Clawperator CLI. The Android Settings
   app package name is: com.android.settings
2. Navigate within Settings to find the Android version. It is typically
   found under "About phone" or "About device".
   Example path: Settings -> About phone -> Android version.
3. Use the observe-decide-act loop: snapshot the current state, decide
   what to do, execute an action, repeat.
   Concrete workflow:
   1. Take a snapshot of the current UI.
   2. Inspect visible text and elements.
   3. Decide the next action (tap, open app, scroll, or go back).
   4. Execute that action.
   5. Repeat until the Android version is known.
4. When you have determined the Android version, output exactly this line:

   CLAWPERATOR_EVAL_ANSWER: <version>

   where <version> is the numeric version string only (e.g. "15" or "14",
   not "Android 15"). You may revise your answer by outputting the line
   again - the last occurrence is used.

5. If you cannot determine the version within your allowed attempts, output:

   CLAWPERATOR_EVAL_ANSWER: unknown

Constraints:
- Use only Clawperator commands for device interaction. Do not use adb
  shell commands or any other method to read the version.
- Execute Clawperator commands exactly as shell commands using the provided
  base command. Do not reinterpret or rewrite the command structure.
- Reference only the public documentation at $DOCS_URL.
- Use $CLAWPERATOR_CMD as the command to invoke Clawperator
  (e.g. `node /home/user/repo/apps/node/dist/cli/index.js` or `clawperator`).
- Pass --device $DEVICE_SERIAL on every Clawperator command.
- Pass --operator-package $CLAWPERATOR_OPERATOR_PACKAGE on every
  Clawperator command.
```

### CLI Entry Point

`run_eval.py` must support:

```
python evals/run_eval.py android-version \
  --agent claude \
  --model claude-sonnet-4-20250514 \
  [--device <serial>] \
  [--mode public-surface|full-repo] \
  [--runtime local-dev|published] \
  [--timeout-s 300] \
  [--max-turns 40] \
  [--label baseline-sonnet] \
  [--runs-dir evals/runs] \
  [--dry-run]
```

`--dry-run` must print, in this order:
- resolved config
- prompt file path
- prompt sha256
- exact agent command
- work dir
- env overrides
- substituted prompt text

Then exit 0 without spawning an agent.

`--mode full-repo` must raise a clear error in Phase 1: "full-repo mode is not
yet implemented (Phase 3)".

`--runtime published` must raise a clear error in Phase 1: "published runtime
is not yet implemented (Phase 3)".

`--rescore` is not implemented in Phase 1. Raise: "rescore is not yet
implemented (Phase 2)".

`--label` is optional. Record it in config.json and append a filesystem-safe
slug to `run_id` when present.

Successful run: print the run directory path to stdout on completion.
Also print a one-line human summary on stdout in the form
`PASS | claude/sonnet | 87.4s | answer=15` (status, agent/model shorthand,
wall-clock duration, normalized answer).

### README

`evals/README.md` must include:
- Prerequisites (Python 3.11+, device connected, Operator APK installed,
  tasks/docs/gaps/ PR merged)
- How to run the first eval (exact command)
- How to read result.json (field descriptions)
- How `public-surface` isolation works (soft isolation: temp dir, no repo files placed in it,
  no repo paths in env or prompt - but not a hard sandbox)
- Note: runs are not parallel (one device, one run at a time)
- How to add a new agent adapter (pointer to `agents/base.py`)
- Note that `CLAWPERATOR_EVAL_ANSWER` is an internal eval marker and must
  not appear in public-facing documentation or production usage
- Known failure patterns:
  - agent loops on the same screen
  - agent never emits `CLAWPERATOR_EVAL_ANSWER`
  - agent uses `adb` directly and the run only records the violation
  - agent guesses the answer without using Clawperator

### Internal Design Doc (best-effort)

Write this if time allows in 1c. If the other 1c deliverables are done and
validated, the design doc can ship in a follow-up commit after 1d passes. It
must not block the PR from landing.

`docs/internal/design/evals.md` must cover these topics in order:

1. **Why evals exist** - measurement instrument for docs quality and API
   discoverability. The harness answers: "Can an unfamiliar agent use
   Clawperator's public surfaces to complete a task on a real device?"
2. **Measurement-not-teaching principle** - the eval is a ruler, not a
   textbook. Eval prompts, spec files, and `CLAWPERATOR_EVAL_ANSWER` must
   never appear in public docs. If agents see the marker in docs, future
   runs measure eval familiarity rather than real capability.
3. **`CLAWPERATOR_EVAL_ANSWER` marker** - internal eval artifact. Not a
   production API. Not published on `docs.clawperator.com` or
   `clawperator.com`. Agents emit it only because the eval prompt instructs
   them to. Must not appear in production transcripts.
4. **Two-axis model** - knowledge surface x runtime target. Explain each
   value and what it isolates. Include the phase each combination becomes
   testable.
5. **Public-surface isolation** - why `tempfile.mkdtemp()`. Why the repo
   path must not appear in the agent's cwd, prompt, or inherited env vars.
   Clarify that this is soft isolation (the harness does not sandbox the
   agent) - the claim is "the agent was not given repo access," not "the
   agent was prevented from accessing the repo."
6. **Doctor pre-flight** - why the harness aborts before spawning the agent
   on doctor failure rather than letting the agent discover it.
7. **`used_disallowed_tool` detection** - the chosen heuristic (fill in
   after implementation), why it is diagnostic-only, why false negatives are
   acceptable in Phase 1.
8. **Open Question resolutions** - record the empirical answers to the Phase
   1 open questions (Claude context file requirement; transcript cap behavior).
9. **Compatibility matrix** - future public artifact. When Phase 1 has >= 10
   runs across >= 2 agents, create `docs/evals-compat.md` with agent/model
   pass rates. That page is the appropriate public output - it does not expose
   prompts, markers, or harness internals.

Write `docs/internal/design/evals.md` after implementing the harness (sub-phase
1b) and spec (1c), so the heuristic and open question answers are known. It is
acceptable to write a placeholder for the `used_disallowed_tool` heuristic
section and fill it in after the 1d validation runs reveal the real pattern.

### Steps

1. Create `evals/specs/android-version/spec.json` with the content above.
2. Create `evals/specs/android-version/prompt-public.md` with the prompt above.
3. Create `evals/run_eval.py` with the CLI spec above. Use Python's `argparse`.
4. Create `evals/README.md` with the required sections above.
5. Verify dry-run works:
   ```bash
python evals/run_eval.py android-version \
     --agent claude --model claude-sonnet-4-20250514 --dry-run
   ```
   Expected: prints resolved config, exact command, work dir, env overrides,
   and prompt text; exits 0, no agent spawned.
6. Write `docs/internal/design/evals.md` covering the 9 topics specified above
   if time allows. Sections 1-6 and 9 can be written now. Sections 7 and 8 may
   use a placeholder pending 1d validation runs. If this step must be deferred,
   commit the other deliverables and write the design doc as an immediate
   follow-up commit after 1d passes.

### Acceptance Criteria

- `evals/specs/android-version/spec.json` is valid JSON.
- `evals/specs/android-version/prompt-public.md` contains the required template
  variables (`$CLAWPERATOR_CMD`, `$CLAWPERATOR_OPERATOR_PACKAGE`,
  `$DEVICE_SERIAL`) and the `CLAWPERATOR_EVAL_ANSWER` marker definition.
- `python evals/run_eval.py android-version --agent claude --model test --dry-run`
  exits 0 and prints the substituted prompt.
- `python evals/run_eval.py android-version --agent claude --model test --mode full-repo`
  exits non-zero with the Phase 3 message.
- `evals/README.md` contains the words "public-surface" and "temp".
- `evals/README.md` contains a note that `CLAWPERATOR_EVAL_ANSWER` is an
  internal marker that must not appear in public docs.
- `docs/internal/design/evals.md` exists and covers all 9 required topics OR
  is committed as an immediate follow-up after 1d passes (present OR committed
  as immediate follow-up).

### Validation

```bash
python -m json.tool evals/specs/android-version/spec.json > /dev/null && echo "valid json"
python evals/run_eval.py android-version --agent claude --model test --dry-run
python evals/run_eval.py android-version --agent claude --model test --mode full-repo; echo "exit: $?"
grep -q "CLAWPERATOR_EVAL_ANSWER" evals/README.md && echo "marker note present"
ls docs/internal/design/evals.md && echo "design doc present"
```

### Expected Commit

```
feat(evals): add android-version eval spec, prompt, CLI, README, and internal design doc
```

---

## Sub-phase 1d: Validation Runs

### Agent Tier

default

### Goal

Run the eval with a real connected device and verify that all Phase 1
acceptance criteria are met: 1 passing run, 1 error run, dry-run exits 0.

### Required Environment

- Android device connected with Clawperator Operator APK installed and
  permissioned.
- `tasks/docs/gaps/` PR changes in place (or at least the current docs are
  sufficient for the agent to have a fair shot - note this in findings if not
  yet merged).
- Branch-local CLI built: `npm --prefix apps/node run build`.

### Steps

1. Verify environment:
   ```bash
   adb devices
   node apps/node/dist/cli/index.js doctor \
     --operator-package com.clawperator.operator.dev
   ```
2. Run the eval once. Record the run ID and outcome.
   Use an explicit device serial if more than one device is connected:
   ```bash
python evals/run_eval.py android-version \
     --agent claude --model claude-sonnet-4-20250514 \
     --device <device_serial>
   ```
3. Verify the run is `pass`. Read the passing transcript and verify it shows
   real `[Clawperator-Result]` envelopes in the output.
4. Simulate an environment failure. Disconnect the device or stop the
   Operator APK, then run:
   ```bash
python evals/run_eval.py android-version \
     --agent claude --model claude-sonnet-4-20250514
   ```
   Verify the output shows `outcome.status = "error"` in `result.json`.
5. Run dry-run and verify it exits 0 with the prompt printed.
6. Capture run IDs of the passing run and error run.
   Note them in this section for human review.

### Acceptance Criteria

All must be true:
1. At least 1 `result.json` with `outcome.status = "pass"` and
   `outcome.answer_correct = true`.
2. At least 1 `result.json` with `outcome.status = "error"` and a non-null
   `failure_reason`.
3. The passing transcript contains at least one line with `[Clawperator-Result]`.
4. Dry-run exits 0 with the prompt printed.
5. `evals/runs/` is gitignored:
   ```bash
   git check-ignore -v evals/runs/
   ```

### Validation

```bash
# Check gitignore
git check-ignore -v evals/runs/

# Check a passing result.json
cat evals/runs/<passing_run_id>/result.json | python -m json.tool

# Check that transcript has Clawperator envelopes
grep -c '\[Clawperator-Result\]' evals/runs/<passing_run_id>/transcript.txt
```

### Expected Commit

```
feat(evals): validate Phase 1 eval harness with passing runs
```
