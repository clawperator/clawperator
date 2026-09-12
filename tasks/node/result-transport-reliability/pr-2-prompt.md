# PR-2 implementation prompt

Complete PR-2 in `tasks/node/result-transport-reliability`: investigate the recurring result-reader exit observed at `6367227a`, implement only evidence-supported repairs, and retain accurate uncertainty and failure diagnostics.

Use [plan.md](plan.md) for the contract and the PR-2 section of [work-breakdown.md](work-breakdown.md) for scope and acceptance. R13 PR-1 is merged in `0c4ed5ce`; work from current main containing that implementation and integrated hierarchy preparation. Preserve every declared failed attempt, strict transport integrity and no-replay behavior. Complete regression and bounded live verification, in-scope repairs, durable docs/status and local commits. Report any unresolved causal blocker honestly.

R14 is independent and outside this PR. Do not implement media changes, launch automatic emulator CI, push, merge or publish.
