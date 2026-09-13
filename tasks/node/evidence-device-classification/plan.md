# Physical-device evidence classification

Status: [TODO]. Priority P1 in the [v0.10.x plan](../../releases/v0.10.x/plan.md).

## Outcome and evidence

Allow a physical device with successfully read system properties but absent
emulator flags to produce complete still/video evidence when all other required
components succeed. Published 0.10.0 marked both bundles partial with
`EVIDENCE_CAPTURE_FAILED`, stage `metadata`, component `deviceType`, despite
verified media and hierarchies. Source inspection at `626a169d` confirms this:
`collectEvidenceMetadata` collapses failed reads to empty strings and requires
an explicit `0` to classify physical hardware.

## Scope and decisions

Preserve read outcome separately from property presence. Use the following
explicit classification policy: a successful, parseable property inventory with
both emulator flags absent is physical by inference; either flag equal to `1`
is emulator, including conflicting `0`/`1`; a `0` with the other absent or `0`
is physical. Unexpected nonempty values without a `1`, unusable inventories,
timeouts and failed reads remain unknown and cannot be normalized to success.
Document that emulator flags are a classification heuristic, not hardware
attestation. Retain raw nullable flag values in the manifest.

Keep unknown classification as a metadata failure for this patch. Do not add a
warning-only manifest contract, rewrite historical manifests, weaken artifact
integrity, or hide unrelated metadata failures. Apply the same collector policy
to still and video; no Android or consumer workaround is required.

## Owners and permanent documentation

- `apps/node/src/domain/evidence/metadata.ts`: read outcomes and classification.
- `apps/node/src/domain/evidence/capture.ts` and `video.ts`: bundle status consumers.
- `apps/node/src/contracts/evidence.ts`: preserve schema and error semantics.
- `apps/node/src/test/unit/evidenceCapture.test.ts`, `evidenceVideo.test.ts` and
  `evidenceWorker.test.ts`: existing fixtures and lifecycle coverage.
- Update `docs/api/evidence.md` and `docs/internal/design/still-evidence.md`
  using `.agents/skills/docs-author/SKILL.md`; record the inference and limits.

## Acceptance

Regression cases cover absent flags in a valid inventory, explicit physical and
emulator indicators, contradictory indicators, unexpected values, empty or
malformed output, nonzero exit, thrown read and exhausted budget. Other required
metadata failures must still yield partial evidence. Still and finalized video
must agree on classification and terminal status.

A physical device with absent flags must produce new complete still/video
bundles, zero terminal CLI exit, valid hashes/hierarchy, and independently
playable video when all components succeed. An emulator must remain classified
as emulator. Preserve old partial evidence as historical evidence.
