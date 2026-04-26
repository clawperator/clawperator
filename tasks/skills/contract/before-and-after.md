# SkillResult Contract Before And After

**Purpose:** preserve the concrete run that exposed the contract problem and
define the expected final shape after PR-C1, PR-S1, and PR-C2.

## Seed Skill For PR-S1

PR-S1 should migrate this skill first:

```text
com.globird.energy.get-yesterday-usage-cost-replay
```

Reason: this skill produced the motivating example for the contract work. It is
a small read skill with one scalar answer, so it is the best first proof that
`skillResult.result` is discoverable without scraping `output`, checkpoint ids,
or `terminalVerification.observed`.

Use a branch-local Clawperator Node build from PR-C1 when validating it:

```bash
CLAWPERATOR_SKILLS_REGISTRY=~/src/clawperator-skills/skills/skills-registry.json \
  node ~/src/clawperator/apps/node/dist/cli/index.js skills run \
  com.globird.energy.get-yesterday-usage-cost-replay \
  --device <device_serial>
```

## Before

The observed run returned a successful wrapper, but the domain answer was not in
a canonical answer field.

Important observed properties:

- wrapper `status` was `success`
- wrapper `output` contained progress lines, a human answer line, the
  `[Clawperator-Skill-Result]` marker, and the framed JSON
- parsed `skillResult` was present
- parsed `skillResult.result` was absent
- the answer `-$3.10` was only available through:
  - `output`
  - `skillResult.checkpoints[].evidence`
  - `skillResult.terminalVerification.observed`

Reduced observed shape:

```json
{
  "status": "success",
  "skillId": "com.globird.energy.get-yesterday-usage-cost-replay",
  "output": "[skill:com.globird.energy.get-yesterday-usage-cost-replay] Launching GloBird for a fresh replay run...\n[skill:com.globird.energy.get-yesterday-usage-cost-replay] Opening the Energy tab...\n[skill:com.globird.energy.get-yesterday-usage-cost-replay] Reading Yesterday usage cost...\n[skill:com.globird.energy.get-yesterday-usage-cost-replay] Parsed Yesterday usage cost.\nGloBird yesterday usage cost: -$3.10\n[Clawperator-Skill-Result]\n{\"contractVersion\":\"1.0.0\",\"skillId\":\"com.globird.energy.get-yesterday-usage-cost-replay\",\"goal\":{\"kind\":\"read_yesterday_usage_cost\"},\"inputs\":{},\"status\":\"success\",\"checkpoints\":[{\"id\":\"opened-energy-screen\",\"status\":\"ok\",\"note\":\"Opened GloBird and reached the Energy screen.\"},{\"id\":\"parsed-yesterday-usage-cost\",\"status\":\"ok\",\"evidence\":{\"kind\":\"text\",\"text\":\"-$3.10\"},\"note\":\"Extracted the signed dollar amount under Yesterday usage -> Cost.\"}],\"terminalVerification\":{\"status\":\"verified\",\"expected\":{\"kind\":\"text\",\"text\":\"Signed dollar amount under Yesterday usage -> Cost\"},\"observed\":{\"kind\":\"text\",\"text\":\"GloBird yesterday usage cost: -$3.10\"}},\"diagnostics\":{\"runtimeState\":\"healthy\"}}\n",
  "exitCode": 0,
  "skillResult": {
    "contractVersion": "1.0.0",
    "skillId": "com.globird.energy.get-yesterday-usage-cost-replay",
    "goal": {
      "kind": "read_yesterday_usage_cost"
    },
    "inputs": {},
    "status": "success",
    "checkpoints": [
      {
        "id": "opened-energy-screen",
        "status": "ok"
      },
      {
        "id": "parsed-yesterday-usage-cost",
        "status": "ok",
        "evidence": {
          "kind": "text",
          "text": "-$3.10"
        }
      }
    ],
    "terminalVerification": {
      "status": "verified",
      "expected": {
        "kind": "text",
        "text": "Signed dollar amount under Yesterday usage -> Cost"
      },
      "observed": {
        "kind": "text",
        "text": "GloBird yesterday usage cost: -$3.10"
      }
    },
    "diagnostics": {
      "runtimeState": "healthy"
    },
    "source": {
      "kind": "script"
    }
  }
}
```

## After PR-C1 And PR-S1

After PR-C1 adds migration-phase schema support and PR-S1 migrates the GloBird
skill, the same run should expose the scalar answer at
`skillResult.result`.

Expected properties:

- `skillResult.result` is present
- `skillResult.result` is evidence-shaped
- parsed `skillResult.status` is still `success`
- inside `skillResult`, `result` is the first field and `status` is second
- duplicate top-level `status`, `skillId`, `exitCode`, and `output` are absent
- checkpoints and terminal verification still prove how the value was found
- diagnostics contains only runtime health, hints, warnings, paths, timings, or
  debug metadata

Expected reduced shape:

```json
{
  "skillResult": {
    "result": {
      "kind": "text",
      "text": "-$3.10"
    },
    "status": "success",
    "contractVersion": "1.0.0",
    "skillId": "com.globird.energy.get-yesterday-usage-cost-replay",
    "goal": {
      "kind": "read_yesterday_usage_cost"
    },
    "inputs": {},
    "checkpoints": [
      {
        "id": "opened-energy-screen",
        "status": "ok",
        "note": "Opened GloBird and reached the Energy screen."
      },
      {
        "id": "parsed-yesterday-usage-cost",
        "status": "ok",
        "evidence": {
          "kind": "text",
          "text": "-$3.10"
        },
        "note": "Extracted the signed dollar amount under Yesterday usage -> Cost."
      }
    ],
    "terminalVerification": {
      "status": "verified",
      "expected": {
        "kind": "text",
        "text": "Signed dollar amount under Yesterday usage -> Cost"
      },
      "observed": {
        "kind": "text",
        "text": "GloBird yesterday usage cost: -$3.10"
      },
      "note": "The replay parser found a signed dollar amount in the recorded Yesterday usage cost slot."
    },
    "diagnostics": {
      "runtimeState": "healthy",
      "hints": [
        "This replay depends on the current GloBird Energy tab labels remaining stable."
      ]
    },
    "source": {
      "kind": "script"
    }
  }
}
```

## After PR-C2

After PR-C2, the expected shape above remains the same for this skill, but the
schema now rejects framed `SkillResult` objects that omit `result`.

For this seed skill, the final acceptance check is:

```text
skillResult.result.kind == "text"
skillResult.result.text matches /^[-+]?\$\d+(\.\d{2})?$/
skillResult.status == "success"
skillResult object starts with result, then status
top-level status, skillId, exitCode, and output fields are absent
```

This check is intentionally answer-path focused. The exact dollar amount depends
on the account and day; the contract requirement is that the signed dollar
amount is exposed at `skillResult.result`.
