# API Refactor Decisions

Status: accepted

Source context: `tasks/api/refactor/plan.md` -> `Items Rejected`

## Decisions

### No `device` namespace for device-management commands

Rejected grouping `devices`, `doctor`, and `version` under a `device` namespace.

Reason:
- those commands are already clear as flat top-level verbs
- adding a namespace would recreate the discoverability tax that the refactor removed from `action` and `observe`
- the public API should stay guessable from common CLI conventions

Consequence:
- keep `devices`, `doctor`, and `version` as top-level commands
- do not reintroduce a `device` namespace in future CLI work
