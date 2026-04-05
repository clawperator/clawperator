# Phase 4 Pre-Implementation Findings

## Alignment Check Answers

1. The minimal skill shape is the `SkillEntry` interface in `apps/node/src/contracts/skills.ts`:
   - `id`
   - `applicationId`
   - `intent`
   - `summary`
   - `path`
   - `skillFile`
   - `scripts`
   - `artifacts`

   The current registry validator in `apps/node/src/domain/skills/validateSkill.ts` also expects the skill entry to be present in the local registry and checks that `skill.json`, `SKILL.md`, each script, and each artifact exist on disk. A naive agent that emits only a tool-call transcript or a single JSON blob without registry metadata will not match this contract.

2. The generated artifact needs to be a runnable skill package, not just an agent-readable strategy note. The runtime executes a registry-backed skill by locating its script files and running them through `clawperator skills run`. That means the Phase 4 emission contract must either capture enough file content to materialize a temp skill package or we must keep this phase at structural validation only.

3. The replay path can only execute a registered skill from the local registry. `clawperator skills run` resolves the skill ID, loads the registry, picks a script from `scripts`, and spawns that script. It does not execute an arbitrary LLM dump of tool calls. So a raw transcript is not replayable without first being turned into a real skill package.

4. For this phase, the safest interpretation is:
   - Skill scoring starts as a structure test against the skill package contract.
   - Replay is the separate execution test that materializes the emitted skill into a temp registry and runs it deterministically.

## Chosen Skill Output Contract

The emitted skill block will be a single JSON object whose top-level fields satisfy `SkillEntry`, and it may also include inline file-content fields so replay can materialize a temp skill package without committing anything to the repository.

The durable validation gate in 4a is structural: parse the JSON, verify the required registry fields and types, and reject malformed or incomplete output before replay.

The replay step in 4b will use the same skill JSON block, write any inline files into a temp directory, register the skill there, and run it with the original device serial.

The replay scorer will treat the skill as successful only when the skill script's output contains `CLAWPERATOR_EVAL_ANSWER: <version>`. When `clawperator skills run --json` is used, the evaluator will read the raw `output` field from that JSON wrapper and score the marker from there. Replay remains deterministic because it runs the materialized skill package directly against the original device serial with a fixed wall-clock timeout.
