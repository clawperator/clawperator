# Work breakdown

- [DONE] Create feat/media-observation-evidence and inspect existing media paths.
- [DONE] Add status evidence fields and observe_media across Android, Node, CLI,
  typed decoding and background readiness. Retain 64 callback samples, all-report
  count, starting/ending status and reported-position delta.
- [DONE] Apply api-agent-ux: readable sample states, duration recovery guidance,
  explicit return-at-end help and documented discover/select/observe/interpret flow.
- [DONE] Validate strict duration/selector ingress, CLI global flag placements and
  JSON exits, callback counts/null reports/truncation, cancellation cleanup,
  session expiry, old payload compatibility and retained typed samples.
- [DONE] Android debug build, app tests, toolkit tests and operator parser tests.
- [DONE] Docs build with no organization warnings; generated files updated.
- [DONE] Live API 26 emulator proof with matching debug Operator: locked/screen-off
  two-second observation received 18 reports and 1849 ms reported-position delta;
  one-second stalled interval received zero reports/delta while estimates advanced.
  Independent fixture state and wake counters passed. Typed Node and HTTP bounded
  observations also passed. A 30-second call completed in 30002 ms, counted 181
  callbacks and retained 64 with truncated=true.
- [DONE] Final Node suite: 1661 tests passed, zero failures. Implementation,
  documentation, validation and task pack completed as one local commit.

Live evidence is in /tmp/media-observation-proof on the validation host. The
extended run.py and http-helper-observe.mjs are already wired into the existing
manual live CI workflow. Initial validation was disrupted by docs dependency
refresh during Node tests, leaving an orphaned fake-device recording lock. Its
fixture directory was confirmed missing before removing only that test lock.
No production recording state was removed.

Sibling runtime skills and bundled skills have no consumers of the changed media
contract, so no skill version changes are needed. Physical-device/browser-specific
behavior and live remote playback were not tested; these are not universal
playback/output guarantees. No push, release or additional PR phase is authorized.
