# Generated skill execution

The public contract and migration guidance belong in
[Skill authoring](../../skills/authoring.md). Existing generated skills require
manual updates; scaffolding does not migrate runtime packages or change the
SkillResult protocol.

## Implementation rationale

`apps/node/src/domain/skills/scaffoldSkill.ts` owns the generated script.
It uses `spawnSync` to retain stdout and stderr for successful and failed
children, forwards Buffers without decoding, and sets `process.exitCode` so
pending stream writes can finish. Child status is authoritative; printable
JSON cannot convert failure into success. Runner errors and signals take
precedence over numeric status and normalize to exit 1. The argument array,
command resolution, and 120000 ms child timeout remain unchanged.

## Regression verification

The `scaffoldSkill` suite in `apps/node/src/test/unit/skills.test.ts` creates
real temporary skills and executes their generated scripts against fake child
commands. It covers both streams on success and failure, JSON with exit 7,
non-JSON failure, empty stdout, SIGTERM, ENOENT, timeout, unusable status,
missing device arguments, quoted command paths, and local CLI resolution.
The timeout test preloads a child-runner override that asserts the production
120000 ms timeout and substitutes 500 ms; no public timeout seam is exposed.

Run the focused suite explicitly after building Node, since the package test
selection does not include this root-level test file:

```bash
npm --prefix apps/node run build
node --test --test-name-pattern=scaffoldSkill apps/node/dist/test/unit/skills.test.js
```

Implementation `ebba364` passed the Node build, 306 package tests, 24 focused
scaffold tests, and the docs build with no organization warnings. This is a
host-only generation change; no Android proof or sibling skill migration was
needed. Subsequent template changes should repeat the relevant subprocess
checks rather than relying on template substring assertions alone.
