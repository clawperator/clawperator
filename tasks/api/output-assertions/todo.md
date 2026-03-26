# Output Assertion Follow-up TODO

Created: 2026-03-17

## [DONE] 2026-03-27

`expectContains` is enforced in [`apps/node/src/domain/skills/runSkill.ts`](../../../apps/node/src/domain/skills/runSkill.ts) after a successful exit (trailing optional parameter). [`apps/node/src/cli/commands/skills.ts`](../../../apps/node/src/cli/commands/skills.ts) and [`apps/node/src/cli/commands/serve.ts`](../../../apps/node/src/cli/commands/serve.ts) pass it through and map `SKILL_OUTPUT_ASSERTION_FAILED` to the same CLI and HTTP JSON shapes as before. Domain coverage lives in `apps/node/src/test/unit/skills.test.ts` under `describe("runSkill")`.

---

## Push output assertion logic into `runSkill` (historical)

### Problem (resolved)

`expectContains` checking lived in the CLI layer (`cmdSkillsRun` in
`apps/node/src/cli/commands/skills.ts`) rather than inside `runSkill` itself.

The HTTP serve path called `runSkill` directly and re-implemented the same
assertion check independently in `apps/node/src/cli/commands/serve.ts`.

### Why it mattered

- Any change to assertion semantics had to be applied in two places.
- The assertion result shape and error fields could drift between the CLI and
  HTTP paths silently.
- `runSkill` callers outside those two surfaces had no assertion support
  without another duplication.

### Desired outcome (implemented)

Assertion handling is in `runSkill`; duplicate checks were removed from
`cmdSkillsRun` and the serve handler. Unit tests exercise the assertion path
through `runSkill` directly.
