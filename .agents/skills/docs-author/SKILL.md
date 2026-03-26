---
name: docs-author
description: Author, update, and verify public documentation pages in docs/. Use when creating new doc pages, updating existing pages to match code changes, or improving documentation quality. This skill governs content work - for build compilation, use docs-build.
---

# Docs Author

Author and update public documentation in `docs/`.

This skill is for content work: writing new pages, updating existing pages to
reflect code changes, and improving documentation quality. For compiling the
docs site (assembly, MkDocs build, llms-full.txt generation), use the
`docs-build` skill.

## Governing Document

Before writing or updating any documentation, read:

**`docs/internal/documentation-drafting-north-star.md`**

This is the governing philosophy for all documentation work. It defines:
- what good documentation looks like
- how to verify claims against code
- page completeness requirements by type
- known failure patterns to avoid
- terminology rules

Read it in full before your first page. Reread it before starting each subsequent page.

## Exemplar Pages

These pages represent the target quality bar. Study them before writing:

- `docs/setup.md` - quality bar for setup/how-to pages
- `docs/api/actions.md` - quality bar for API reference pages
- `docs/api/environment.md` - quality bar for configuration/environment pages

If your page does not have the same depth as the relevant exemplar, it is not done.

## The One Rule That Matters Most

**CODE IS THE SOURCE OF TRUTH.**

Existing documentation - including other pages in `docs/` - is advisory only. For every fact you write:

1. Open the relevant source file in `apps/node/src/`
2. Read the actual code
3. Write the doc based on what the code does

If existing docs and code disagree, the code is correct.

## How to Verify Against Code

Use this table for every page. Open the listed files before writing.

| Topic | Verify against |
|-------|---------------|
| CLI commands, flags, aliases | `apps/node/src/cli/registry.ts` |
| Action types and parameters | `apps/node/src/contracts/execution.ts` |
| Selector flags and behavior | `apps/node/src/cli/selectorFlags.ts`, `apps/node/src/contracts/selectors.ts` |
| Error codes and meanings | `apps/node/src/contracts/errors.ts` |
| Result envelope shape | `apps/node/src/contracts/result.ts` |
| Execution limits and timeouts | `apps/node/src/contracts/limits.ts` |
| Execution validation | `apps/node/src/domain/executions/validateExecution.ts` |
| Execution runtime | `apps/node/src/domain/executions/runExecution.ts` |
| Snapshot extraction | `apps/node/src/domain/executions/snapshotHelper.ts` |
| Environment variables | Grep `process.env.CLAWPERATOR` across `apps/node/src/` |
| Runtime config | `apps/node/src/adapters/android-bridge/runtimeConfig.ts` |
| Navigation builders | `apps/node/src/domain/actions/waitForNav.ts`, `openApp.ts`, `openUri.ts` |
| Recording format | `apps/node/src/domain/recording/recordingEventTypes.ts` |
| Recording parsing | `apps/node/src/domain/recording/parseRecording.ts` |
| Recording CLI | `apps/node/src/cli/commands/record.ts` |
| Skills registry | `apps/node/src/contracts/skills.ts`, `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` |
| Skills runtime | `apps/node/src/domain/skills/runSkill.ts`, `apps/node/src/domain/skills/skillsConfig.ts` |
| Skills CLI | `apps/node/src/cli/commands/skills.ts` |
| Skill validation | `apps/node/src/domain/skills/validateSkill.ts` |
| Skill compilation | `apps/node/src/domain/skills/compileArtifact.ts` |
| Operator setup | `apps/node/src/cli/commands/operatorSetup.ts`, `apps/node/src/domain/device/setupOperator.ts` |
| Permissions | `apps/node/src/domain/device/grantPermissions.ts` |
| Version compatibility | `apps/node/src/domain/version/compatibility.ts` |
| Doctor checks | `apps/node/src/domain/doctor/checks/` |
| Serve endpoints | `apps/node/src/cli/commands/serve.ts` |
| Install script | `sites/landing/public/install.sh` |

## Workflow Per Page

For each page you author or update:

1. **Read code first.** Open the authoritative source files from the table above.
2. **Draft the page** based on what the code does.
3. **Run the build:** `./scripts/docs_build.sh` - must pass before committing.
4. **Commit:** `docs: draft <page-name> - verified against <source-files>`
5. **Reread your draft.** Compare it against the code again. Ask yourself:
   - Did I miss any flags, parameters, or action types?
   - Did I copy wording from existing docs without verifying it against code?
   - Is there any claim here that I cannot point to a specific line of code for?
   - Would an agent be able to construct a valid command from this page alone?
   - Does every default value match the exact literal from the code?
   - Is there at least one JSON example showing the output shape?
   - Did I document what happens when a setting is wrong (error codes, failure behavior)?
   - Compare to the exemplars: does my page have the same depth?
6. **Fix issues** found in the reread.
7. **Commit:** `docs: refine <page-name> - <what you fixed>`
8. **Move to the next page.**

Do NOT batch multiple pages into one commit. Each page gets at least one commit
(draft), ideally two (draft + refinement).

Do NOT skip the reread step. Every first draft in this project so far has had
errors that the reread caught.

## Page Completeness Checklist

Before declaring any page done, verify:

- [ ] Every default value is the exact literal from code, not a paraphrase
- [ ] Every parameter's valid values are documented, not just the parameter name
- [ ] At least one concrete JSON example for every major contract on the page
- [ ] At least one verification pattern showing how to confirm the documented behavior
- [ ] Error cases documented: what happens when something is wrong, with exact error codes
- [ ] All error codes referenced exist in `apps/node/src/contracts/errors.ts`
- [ ] An agent could construct valid commands and parse responses using only this page
- [ ] `./scripts/docs_build.sh` passes
- [ ] The page has comparable depth to the exemplar pages

## Terminology Rules (enforced)

- "operator" not "receiver"
- "action" not "command" when referring to execution payload actions
- "selector" not "matcher" (except when referencing the `NodeMatcher` type specifically)
- Primary flag name `--device` (not `--device-id`)
- Primary flag name `--timeout` (not `--timeout-ms`)
- Flat CLI surface: `snapshot` not `observe snapshot`, `click --text` not `action click --selector`
- Never shorten "Clawperator" to "Claw"
- Use regular dashes/hyphens, never em dashes

## Cross-referencing Rules

- Each concept is defined on exactly one page
- Cross-reference using relative markdown links: `[Selectors](selectors.md)`, `[Setup](../setup.md)`
- Do NOT duplicate content that already exists on another page

## Common Mistakes to Avoid

1. **Copying existing docs verbatim.** Existing docs may be stale. Read code first, write from code.
2. **Trusting action type lists from existing docs.** The canonical list is in `contracts/execution.ts`. Read it.
3. **Using old CLI syntax.** It is `snapshot`, not `observe snapshot`. It is `click --text`, not `action click --selector`.
4. **Using "receiver" anywhere.** The correct term is "operator".
5. **Writing prose where a table suffices.** Agents parse tables better than paragraphs.
6. **Duplicating content across pages.** Cross-reference instead.
7. **Batching multiple pages into one commit.** One page per commit minimum.
8. **Not rereading your draft.** Your first pass will have errors.
9. **Vague defaults.** Writing "logger-specific default" instead of `~/.clawperator/logs`. If the value is a literal in code, write the literal.
10. **Missing error cases.** Documenting what a setting does when correct but not what happens when wrong.
11. **Missing verification patterns.** A page that documents behavior but provides no way for an agent to confirm it.
12. **"Many" and "various" descriptions.** Name the specific category or list the items.

## Validation

After each page, run:

```bash
./scripts/docs_build.sh
```

After all pages in a batch, also run:

```bash
# Check terminology compliance
grep -ri "receiver" docs/api/ docs/skills/ docs/troubleshooting/ docs/index.md docs/setup.md
grep -r "observe snapshot\|action click\|action press" docs/
# Both must return zero results
```

## Page Schema

Every page follows this structure where applicable:

```
# <Topic>

## Purpose          (1-2 lines: what this enables)
## When to use      (concrete triggers)
## Inputs           (exact parameters / state)
## Behavior         (deterministic description)
## Output           (exact shape)
## Failure modes    (enumerated with recovery)
## Example          (minimal, runnable)
```

Reference pages (actions, errors, selectors) use tabular format instead. The
schema is a default, not a straitjacket - adapt it to the page's needs.

## Adding a New Page

When adding a page that does not yet exist:

1. Add the page to `sites/docs/mkdocs.yml` nav in the appropriate section.
2. Create the authored source file in `docs/` at the matching path.
3. If the page has code-derived content, add a `<!-- CODE-DERIVED: id -->` marker and update `sites/docs/source-map.yaml`.
4. Follow the per-page workflow above.
5. Run `./scripts/docs_build.sh` to verify it appears in the build.
