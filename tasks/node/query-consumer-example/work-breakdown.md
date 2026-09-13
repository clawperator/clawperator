# Delivery and validation

One PR, independent of the other new packs. The scoped walkthrough can link to
this example when available; neither pack needs to wait to begin.

Use actual CLI output and existing validators to implement the
[plan's runnable example and empty-matcher diagnostic](plan.md), preserving
public envelope semantics.

## Required checks

- Test the example's acceptance cases and CLI valid/invalid/missing matcher
  values, supported global/command-local placement, exits and structured JSON.
  Run `npm --prefix apps/node run build && npm --prefix apps/node run test`.
- Execute the example through the branch-local CLI on an explicit connected
  device with a matching development Operator and known screen. Include a
  deliberately limited/truncated query; verify refusal of completeness claims.
- Update the canonical docs named in the plan with
  `.agents/skills/docs-author/SKILL.md`; regenerate with docs-build and run
  `./scripts/docs_build.sh`.

Record verification outcomes and any missing live prerequisite in task status;
keep the tested example and its usage guidance in the permanent locations named
in the plan. Fix in-scope failures and commit validated logical units. SDK or
transport redesign and publication are outside this pack.
