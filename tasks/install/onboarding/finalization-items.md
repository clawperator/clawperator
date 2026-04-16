# Install Onboarding Follow-Up Items

These items are intentionally deferred from the install/onboarding cleanup pack.

## Deferred Follow-Up

### F6: Skill preflight and first-run requirements metadata

- **Deferred item:** add first-class preflight or `requires` metadata for
  runtime skills and surface it through `skills get`, plus early structured
  precondition failures where appropriate
- **Why deferred:** this is skill contract and runtime maturity work, not
  install/onboarding cleanup. Pulling it into the onboarding pack would blur the
  boundary between host-agent discovery and skill-runtime redesign.
- **Needed later:** separate task pack under the skills or Node surface
- **Dependencies:** none on this onboarding pack, other than preserving the F6
  rationale from `tasks/install/onboarding/findings.md`
