# Eval System Design

## Purpose

The eval harness measures whether an unfamiliar agent can use Clawperator to
operate a connected Android device and complete a task on a real target. It
also measures whether the same run can emit a reusable Clawperator skill and
replay that skill deterministically.

The harness is a measurement tool, not a planner. Agent reasoning stays
outside the runtime.

## Measurement Boundaries

Every run is described by two independent axes:

| Axis | Values | What it changes |
| --- | --- | --- |
| Knowledge surface | `public-surface`, `full-repo` | Whether the agent sees only public docs or the repository itself |
| Runtime target | `local-dev`, `published` | Whether the run uses the branch-local CLI build or the global release binary |

`public-surface` runs use a fresh temp directory and only expose the public
command surface. `full-repo` runs use the repository root so the agent can read
internal source and docs. The harness does not sandbox filesystem access.

`local-dev` uses the branch-local Node CLI build at
`apps/node/dist/cli/index.js` and the debug Operator APK
`com.clawperator.operator.dev`. `published` uses the globally installed
`clawperator` binary and the release Operator APK `com.clawperator.operator`.

Doctor preflight runs before the agent is spawned. The harness also keeps
`ANDROID_SERIAL` in the agent environment and passes the selected device as an
explicit CLI selector.

## Result Artifacts

Every completed run writes a `result.json` file under `evals/runs/<run_id>/`.
The main task score remains in `outcome`.

When the skill prompt variant is used and the spec defines `skill_generation`,
the harness adds a `skill_score` block to `result.json`.

If preflight fails before the agent starts, the harness still writes
`config.json` and `result.json`. Those artifacts keep the generic
`outcome.failure_reason` such as `doctor_preflight_failed`, and they also add a
`preflight` block with structured doctor diagnostics when the failing step was
`clawperator doctor --json`. Public-surface runs keep only the minimal
`doctor_failure.code` and `doctor_failure.summary` in that block. Full-repo
runs also keep the raw `doctor_report` so engineers can inspect the full doctor
payload when the repo surface is already exposed.

```json
{
  "outcome": {
    "status": "pass",
    "answer_extracted_raw": "Android 16",
    "answer_normalized": "16",
    "ground_truth_normalized": "16",
    "answer_correct": true,
    "failure_reason": null
  },
  "skill_score": {
    "skill_emitted": true,
    "skill_valid": true,
    "skill_validation_errors": [],
    "replay_attempted": true,
    "replay_status": "pass",
    "replay_answer_normalized": "16",
    "replay_answer_correct": true,
    "replay_wall_clock_s": 12.4
  }
}
```

`skill_score` fields:

| Field | Meaning |
| --- | --- |
| `skill_emitted` | The transcript contained a complete skill block between the configured markers. |
| `skill_valid` | The extracted skill passed structural validation against the skill registry contract. |
| `skill_validation_errors` | Validation failures, if any. |
| `replay_attempted` | The harness attempted to run the extracted skill. |
| `replay_status` | `pass`, `fail`, `no_answer`, `error`, or `skipped`. |
| `replay_answer_normalized` | Normalized replay answer used for scoring. |
| `replay_answer_correct` | Whether the replay answer matched the ground truth. |
| `replay_wall_clock_s` | Replay execution time in seconds. |

`skill_score` is independent from the task score. A run can pass the main eval
and fail skill replay, or fail the task and still emit a valid skill.

## Skill Emission Protocol

The skill prompt variant instructs the agent to emit a skill block between the
exact markers:

```text
CLAWPERATOR_SKILL_START
<skill JSON here>
CLAWPERATOR_SKILL_END
```

The extractor keeps the last complete block in the transcript.

The emitted JSON must satisfy the `SkillEntry` contract:

- `id`
- `applicationId`
- `intent`
- `summary`
- `path`
- `skillFile`
- `scripts`
- `artifacts`

Validation is structural. The harness parses the JSON, checks required fields
and replay-readiness constraints, and does not rely on permanent registration
in the user skill store. Required string fields must be non-blank, listed
script and artifact paths must be non-blank strings, and replayable skills
must include inline content coverage for every listed script and artifact.
That keeps replay self-contained and avoids writing generated skills to the
repository.

To make the skill replayable, the emitted JSON may also include inline file
content:

- `skillMarkdown`
- `scriptContents`
- `artifactContents`

The replay materializer writes those files into a temp directory, creates a
temporary registry, and removes everything after the replay finishes.

## Replay Contract

Replay is a separate execution step, not a second agent run.

Replay semantics:

1. Load `config.json`, `result.json`, and `transcript.txt` from the original
   run directory.
2. Extract the last complete skill block.
3. Require that replay uses the same device serial recorded in the run config.
4. Validate the extracted skill structurally.
5. Materialize the skill into a temp directory.
6. Run `clawperator skills run <skill_id> --device <serial> --operator-package
   <package> --skip-validate --json`.
7. Score the replay against the original ground truth.
8. Delete the temp materialization after replay.

Replay has its own wall-clock timeout. The default is 60 seconds, and
`--replay-timeout-s` overrides it.

Current answer surfacing contract:

- Replay only reports `pass`, `fail`, or `no_answer` when `clawperator skills
  run` exited with code `0`. Non-zero exit codes are always `replay_status =
  "error"`.
- If a skill artifact contains a plain-text answer, replay uses that artifact
  content only when the replayed skill created or modified that artifact
  during execution.
- Otherwise replay falls back to the run output and looks for
  `CLAWPERATOR_EVAL_ANSWER: <version>` in the raw output, stdout, stderr, or
  JSON envelope text.

That order matters because some generated skills update their artifact file
during execution. Capturing a seeded artifact answer before the run would be a
false positive if the skill never rewrote the file. Binary or unreadable
artifacts are skipped and do not block stdout or stderr answer extraction.

## Decision Rules

| Question | Rule |
| --- | --- |
| What if no skill block is emitted? | `skill_emitted = false`, replay is skipped. |
| What if skill validation fails? | `skill_valid = false`, replay is skipped. |
| What if replay returns no answer? | `replay_status = "no_answer"` when the run exited cleanly, otherwise `error`. |
| What if replay times out? | `replay_status = "error"` and `replay_wall_clock_s` records the elapsed time. |
| Does task score affect skill score? | No. They are independent. |
| Can generated skills be committed automatically? | No. The harness uses temp materialization only. |

## Failure Modes To Prevent

- Replaying against a different device than the original run used.
- Writing generated skills to a permanent repo location.
- Treating a missing skill block as a task failure instead of a skipped skill
  score.
- Letting replay run indefinitely instead of enforcing the replay timeout.
- Assuming replay should rediscover the Android version. The skill should
  carry the discovered version forward and replay should verify it.
- In `full-repo`, collapsing doctor preflight failures to
  `doctor_preflight_failed` without the associated `code`, `detail`,
  evidence, and fix steps from the doctor report.
- In `public-surface`, retaining more than `doctor_failure.code` and
  `doctor_failure.summary`, or leaking raw doctor reports or host-specific
  paths and commands.

## Operational Guidance

- Use `--mode full-repo` and `--skill-prompt prompt-skill.md` when you want to
  measure skill emission on the strongest available prompt surface.
- Use `--replay <run_id>` to inspect a previous run's emitted skill.
- Pass `--device <serial>` explicitly whenever more than one device is
  connected.
- Keep `skill_score` separate from `outcome` when you analyze runs.
