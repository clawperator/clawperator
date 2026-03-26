# Release Notes Follow-up

## Post-merge items

- Add a large-range mode or batching guidance to the release-notes skill so very long histories are easier to synthesize without drifting into generic prose.
- Add fallback phrasing templates for thin or mixed-purpose commits so low-signal ranges still produce specific user-facing bullets.
- Add optional impact scoring to help prioritize the most user-visible changes when a range has many `keep` commits.
- Add a post-write ordering check so version blocks are validated after insertion and reordered if needed.
- Split or rotate `tasks/release-notes/findings.md` by run or release to keep the audit trail manageable without losing traceability.
- Keep linking every PR that landed in a release block, using the PR title and URL from `gh` so the note doubles as a review index.

## Release PR Index

### v0.5.1

- [task: create docs refactor plan/tasks](https://github.com/clawperator/clawperator/pull/119) `#119`
- [docs: complete phase-2 docs surfaces and doctor links](https://github.com/clawperator/clawperator/pull/121) `#121`
- [Refactor phase 3 agent docs for API, skills, and troubleshooting coverage](https://github.com/clawperator/clawperator/pull/122) `#122`
- [chore(docs-refactor): finalize PR-4 cleanup](https://github.com/clawperator/clawperator/pull/123) `#123`
- [docs(tasks): update docs-build regeneration reference in agent-ui-loop plan](https://github.com/clawperator/clawperator/pull/124) `#124`
- [node: Add timeout version guidance](https://github.com/clawperator/clawperator/pull/125) `#125`
- [Add zero-shot Android exploration skill](https://github.com/clawperator/clawperator/pull/126) `#126`
- [chore(task): cleanup](https://github.com/clawperator/clawperator/pull/127) `#127`

### v0.5.0

- [Add skill progress logging and regression coverage](https://github.com/clawperator/clawperator/pull/104) `#104`
- [chore(skills): rename google home aircon skill to climate](https://github.com/clawperator/clawperator/pull/105) `#105`
- [Reorganize API refactor tasks and add design guiding principles](https://github.com/clawperator/clawperator/pull/106) `#106`
- [refactor(cli): implement registry-driven command dispatch](https://github.com/clawperator/clawperator/pull/107) `#107`
- [refactor: rename receiverPackage to operatorPackage throughout codebase](https://github.com/clawperator/clawperator/pull/108) `#108`
- [refactor(node, docs)!: use flat command surface](https://github.com/clawperator/clawperator/pull/109) `#109`
- [feat: Phase 5A extended CLI commands (scroll-until, close, sleep, --long/--focus, wait --timeout, read --all)](https://github.com/clawperator/clawperator/pull/111) `#111`
- [feat: Phase 5C API refactor - container-scoped read_text](https://github.com/clawperator/clawperator/pull/112) `#112`
- [feat(api): Phase 5B extended commands - wait-for-nav, read-value, exec alignment](https://github.com/clawperator/clawperator/pull/114) `#114`
- [Update the Node API for the final refactor phase](https://github.com/clawperator/clawperator/pull/117) `#117`
