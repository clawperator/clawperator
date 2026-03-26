# Release Notes Findings

## PR-1 Run

### Script output

- Command: `bash .agents/skills/release-notes-author/scripts/gather_commits.sh v0.5.0 v0.5.1`
- Release date: `2026-03-26`
- The range produced 11 commit blocks.
- The key classification anchors were:
  - `b2f7234` - `drop:no-src`
  - `0e90073` - `drop:infra`
  - `7a15048` - `keep`
  - `4248f2d` - `keep`

### Classification summary

| Commit | Subject | Classification | Surfaces | Notes |
|---|---|---|---|---|
| `567f21f` | `docs(release): update published version to 0.5.0` | `keep` | `docs` | Docs content plus generated `llms` artifacts |
| `b2f7234` | `chore(build): set code version to 0.5.1` | `drop:no-src` | `node` | `apps/node/package.json` is `config`; `apps/node/package-lock.json` is `generated`; test files are `infra` |
| `0e90073` | `fix(release): align doctor test with CLI version` | `drop:infra` | - | `.agents/**` plus test files only |
| `7a15048` | `task: create docs refactor plan/tasks (#119)` | `keep` | `docs` | Deleted `docs/skills/skill-from-recording.md` still counts as deleted `src` |
| `4248f2d` | `feat(docs): docs use deterministic build pipeline` | `keep` | `docs` | Broad docs + site restructure with many authored docs paths |
| `bafb456` | `feat(docs, node): revamp setup and API docs (#121)` | `keep` | `node docs` | Cross-surface docs and Node changes |
| `ae4192d` | `feat(docs, node): update API and skillsdocs (#122)` | `keep` | `node docs` | Cross-surface docs and Node changes |
| `dc51c46` | `chore(docs): finalize docs cleanup (#123)` | `keep` | `docs` | Docs cleanup only |
| `5987875` | `skills(docs): update doc-related skills (#124)` | `drop:infra` | - | Skills repo / `.agents/**` only |
| `6020a9e` | `feat(node): add timeout version guidance (#125)` | `keep` | `node` | Node API/CLI behavior change |
| `b6f0c86` | `skill: add zero-shot Android exploration skill (#126)` | `drop:infra` | - | Skill scaffolding only |
| `812d985` | `chore(task): cleanup (#127)` | `drop:infra` | - | Task cleanup only |

### Mismatches

- None observed in the `v0.5.0..v0.5.1` range.

### Synthesis choices

- PR-1 did not include CHANGELOG synthesis yet, so there were no merge or prose decisions to log.
- I added a synthetic deleted-src fixture in `test_gather_commits.sh` because the live repo history did not expose the deleted-src case the plan wanted to spot-check.

### Draft entry

- Not applicable for PR-1.

