# Output Assertion Follow-up TODO

Created: 2026-03-17

## Push output assertion logic into `runSkill`

### Problem

`expectContains` checking currently lives in the CLI layer (`cmdSkillsRun` in
`apps/node/src/cli/commands/skills.ts`) rather than inside `runSkill` itself.

The HTTP serve path calls `runSkill` directly and re-implements the same
assertion check independently in `apps/node/src/cli/commands/serve.ts`.

Current duplication sites:
- `apps/node/src/cli/commands/skills.ts` - `cmdSkillsRun` checks
  `result.output.includes(expectContains)` after a successful run and returns
  `SKILL_OUTPUT_ASSERTION_FAILED` if the substring is absent.
- `apps/node/src/cli/commands/serve.ts` - the `/skills/:id/run` handler
  performs the same check independently.

### Why it matters

- Any change to assertion semantics (e.g. regex support, multi-marker checks,
  case-insensitive matching) must be applied in two places.
- The assertion result shape and error fields could drift between the CLI and
  HTTP paths silently.
- `runSkill` callers outside those two surfaces would get no assertion support
  at all without another duplication.

### Desired outcome

Move assertion handling into `runSkill` (or a thin wrapper called by both
surfaces) so the contract is defined and tested in one place.

Candidate approach:

```ts
// In runSkill signature
export async function runSkill(
  skillId: string,
  args: string[],
  skillsRepoPath?: string,
  timeoutMs?: number,
  expectContains?: string,   // <-- new
): Promise<SkillRunResult | SkillRunError>
```

- If `expectContains` is provided and the skill exits 0 but output does not
  contain the substring, return `{ ok: false, code: SKILL_OUTPUT_ASSERTION_FAILED, ... }`.
- Remove the duplicate checks from `cmdSkillsRun` and the serve handler.
- Update unit tests to exercise the assertion path through `runSkill` directly.

### Guardrails

- Behavior must remain identical for existing callers passing `undefined`.
- The `SKILL_OUTPUT_ASSERTION_FAILED` result shape must stay consistent with
  the current CLI and HTTP error responses to avoid a breaking contract change.
- Add or update unit tests in `apps/node/src/test/unit/skills.test.ts` to
  cover the unified path.
