# Work breakdown

One PR, independent of the other new packs. The scoped walkthrough can link to
this example when available, but neither pack needs to wait to begin.

1. Inspect actual CLI output and current validators. Add the runnable example,
   focused tests for its decision boundaries and the actionable empty-matcher
   diagnostic. Keep public envelope semantics unchanged.
2. Cover valid/invalid/missing matcher values, supported global/command-local
   placement, exit status and structured JSON. Build Node then run Node tests.
3. On a connected explicit device with a matching development Operator, execute
   the example via the branch-local CLI against a known screen, including a
   deliberately limited/truncated query. Verify it refuses completeness claims.
4. Update canonical docs and run `./scripts/docs_build.sh` using docs-build.
   Record any missing live prerequisite, fix in-scope failures, update statuses,
   and commit validated logical units. Stop before SDK or transport redesign.
