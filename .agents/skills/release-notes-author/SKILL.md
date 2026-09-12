---
name: release-notes-author
description: Write a CHANGELOG.md release entry from a git range using the repository's classification helpers.
---

# Release Notes Author

Turn a git range into a changelog entry in `CHANGELOG.md`. The deterministic
helpers own keep/drop and PR ordering; use their output to organize the notes
and verify unclear behavioral claims against the relevant code.

Run: $release-notes-author v0.5.0 v0.5.1

Use the same invocation shape for any release range. It maps to the gather script below.

1. Run the commit gather script and inspect its structured output.

```bash
cd "$(git rev-parse --show-toplevel)"
bash .agents/skills/release-notes-author/scripts/gather_commits.sh <start-tag> <end-tag>
```

2. Run the PR gather script and inspect its structured output.

```bash
cd "$(git rev-parse --show-toplevel)"
bash .agents/skills/release-notes-author/scripts/gather_prs.sh <start-tag> <end-tag>
```

3. Extract the release date from the `RELEASE_DATE:` line.

4. Derive the version by stripping the `v` prefix from the end tag. For example, `v0.5.1` becomes `0.5.1`.

5. Process every commit block using only the `CLASSIFICATION:` line. Never re-derive keep/drop from the file list.

`drop:no-src` and `drop:infra` mean skip the commit. Never skip silently.

The gather script may classify dedicated release-ceremony commits such as
`docs(release): update published version to ...` as `drop:infra` even when they
touch authored docs. Treat that classifier output as authoritative so published
version bumps do not show up as changelog-worthy documentation work.

`keep` means include the commit. Group it by surface using the `SURFACES:` line.

| Path example | Type | Classification result |
|---|---|---|
| `apps/node/src/cli/index.ts` | src | keep |
| `apps/node/src/cli/old-cmd.ts` (deleted) | [deleted][src] | keep (deleted src still counts) |
| `apps/node/src/test/unit/foo.test.ts` | infra | drop:infra |
| `apps/node/package.json` alone | config | drop:no-src |
| `apps/node/package.json` + `package-lock.json` | config + generated | drop:no-src |
| `sites/docs/static/llms-full.txt` alone | generated | drop:no-src |
| `docs/api/actions.md` + `llms-full.txt` | src + generated | keep |

6. Synthesize `keep` commits into bullets.

Write in past tense and describe the user-facing outcome. Use `SUBJECT`, `BODY`,
and `FILES` as the starting evidence. Inspect the relevant diff or source when
those fields leave behavior or breaking-change impact unclear. Keep the helper's
classification and PR ordering; inspecting code is for factual verification.

Use this category rubric:

| Category | Meaning |
|---|---|
| `Added` | A new capability, action, flag, option, endpoint, or behavior that did not exist before |
| `Changed` | An existing capability was modified, renamed, restructured, or now behaves differently |
| `Fixed` | A defect, error condition, or incorrect behavior was corrected |
| `Removed` | A capability was deleted. Always prefix with `**Breaking:**` |

Breaking changes require evidence in commit metadata or the relevant diff that
a public contract changed incompatibly. A deleted source file alone is not
proof. Use `**Breaking:** **Removed:**` for a deleted user-facing capability
without replacement, or `**Breaking:** **Changed:**` for an incompatible rename
or replacement. Do not invent user-facing changes for purely internal deletions.

Merged commits:

Commits that share the same `PR:` number must be merged into one bullet group. Outside the same PR, merge only when the commits share adjacent `FILES` entries in the same module or explicitly cross-reference each other in the `BODY`.

Multi-surface commits appear in each relevant section, but the framing must fit the surface. For Node, describe the behavior change. For Docs, describe the documentation change. If the only cross-surface artifact is a generated file update such as `llms.txt`, omit the redundant bullet.

Every `keep` commit must produce at least one bullet. No silent omissions.

Within each surface section, order bullets as Added, then Changed, then Fixed, then Removed.

7. Write a one-or-two sentence summary.

Apply these rules in order: if breaking changes exist, lead with them. If one surface dominates by count of `keep` commits, name it. Otherwise describe the most significant user-facing outcome, not implementation details.

8. Assemble the release notes block in this format.

```markdown
## [<version>] - <YYYY-MM-DD>

<summary>

### 🤖 Node API & CLI
- **Added:** ...

### 📚 Documentation & Website
- **Added:** ...

### 📱 Android Operator APK
- **Added:** ...

Pull requests:
- [PR title](link to PR)
- [PR title](link to PR)
```

Omit any surface section that has no `keep` bullets. Keep the surface section order exactly as shown here: Node, then Docs, then Android.

9. Append the `Pull requests:` section as the last subsection in each release block. Use the `gather_prs.sh` output verbatim for the list items, sorted from oldest landed PR to newest landed PR. If the helper prints `None found`, keep that line immediately under the heading.

10. Apply the upsert rule to `CHANGELOG.md` using this table. Do not re-derive the logic.

| State | Behavior |
|---|---|
| `CHANGELOG.md` does not exist | Create the file with `# Changelog\n\n`, then apply the no-version-blocks case |
| Target `## [x.y.z]` block present | Replace from that header line up to, but not including, the next `## [` line |
| Target block absent, `## [Unreleased]` present | Insert the new block after the unreleased section and before the next versioned block or EOF |
| Target block absent, no `## [Unreleased]`, at least one `## [x.y.z]` exists | Insert the new block before the first versioned block |
| No version blocks at all | Append the new block at end of file |

11. Verify that no duplicate version headers exist and that entries remain in descending chronological order.
