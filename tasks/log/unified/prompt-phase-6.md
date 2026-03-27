# Phase 6: Final Validation Matrix - Unified Logging Task

You are executing Phase 6 (the final phase) of the unified logging task in the `feature/unified-logging-pr-2` branch. Phases 0-5 are complete. Your job is validation only - run every check, fix any issues found, and prove the diagnostic gap from Phase 0 is closed.

**This phase produces no new features.** You are verifying that everything works together correctly on a real device.

## Required reading

Read these before starting validation:

1. `CLAUDE.md` - repo rules, required iteration loop, device selection rules
2. `tasks/log/unified/plan.md` - the stable contract, expected log output examples (the "before and after" section is your acceptance reference)
3. `tasks/log/unified/work-breakdown.md` - Phase 6 section for the exact steps and acceptance criteria
4. `tasks/log/unified/runs/phase-0-baseline-log.jsonl` - the Phase 0 baseline to compare against

## Environment setup

Every command in this phase uses the branch-local Node API build, not the global `clawperator` binary.

```bash
npm --prefix apps/node run build
export CLAWPERATOR_BIN="node $(pwd)/apps/node/dist/cli/index.js"
export CLAWPERATOR_OPERATOR_PACKAGE="com.clawperator.operator.dev"
export CLAWPERATOR_SKILLS_REGISTRY="$(cd ../clawperator-skills && pwd)/skills/skills-registry.json"
```

Check connected devices and pick the physical device if both physical and emulator are connected:

```bash
node apps/node/dist/cli/index.js devices
```

Replace `<device_serial>` in all commands below with the actual serial from the output above.

## Validation steps (execute in order)

### Step 1: Build and test

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```

All tests must pass. If any fail, fix them before continuing.

### Step 2: Android build (if Android source was changed - check first)

```bash
# Only needed if apps/node/ changes affected Android. Check:
git diff origin/main --name-only | grep -q "^app/" && echo "Android changes detected" || echo "No Android changes"

# If Android changes detected:
./gradlew app:assembleDebug
./gradlew app:testDebugUnitTest
```

### Step 3: Smoke scripts

```bash
./scripts/clawperator_smoke_core.sh
./scripts/clawperator_smoke_skills.sh
```

Both must pass. If either fails, investigate and fix before continuing.

### Step 4: End-to-end logging flow

This is the most important step. Run the climate skill and verify logging works correctly.

First, clear today's log file to get a clean capture:

```bash
LOG_PATH="${CLAWPERATOR_LOG_DIR:-$HOME/.clawperator/logs}/clawperator-$(date +%F).log"
cp "$LOG_PATH" "$LOG_PATH.pre-phase6" 2>/dev/null || true
> "$LOG_PATH"
```

Run the climate skill with debug logging:

```bash
node apps/node/dist/cli/index.js skills run \
  com.google.android.apps.chromecast.app.get-climate \
  --device <device_serial> \
  --operator-package com.clawperator.operator.dev \
  --format pretty --log-level debug -- "Office"
```

The skill may fail to parse HVAC status - that is OK. What matters is that log events are written.

Now verify the log file:

```bash
echo "=== Event types in log file ==="
cat "$LOG_PATH" | python3 -c "
import sys, json, collections
counts = collections.Counter()
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    try:
        counts[json.loads(line)['event']] += 1
    except: pass
for event, count in sorted(counts.items()):
    print(f'  {event}: {count}')
print(f'Total events: {sum(counts.values())}')
has_output = 'skills.run.output' in counts
has_banner = 'cli.banner' in counts
has_start = 'skills.run.start' in counts
has_complete = 'skills.run.complete' in counts
print(f'')
print(f'skills.run.output present: {has_output}')
print(f'cli.banner present: {has_banner}')
print(f'skills.run.start present: {has_start}')
print(f'skills.run.complete present: {has_complete}')
if not has_output:
    print('FAIL: skills.run.output events missing from log file')
    sys.exit(1)
if not has_start or not has_complete:
    print('FAIL: lifecycle events missing from log file')
    sys.exit(1)
print('PASS: all expected event types present')
"
```

**Required result:** `skills.run.output`, `cli.banner`, `skills.run.start`, and `skills.run.complete` must all be present. If any are missing, the unified logging work is not functioning correctly.

### Step 5: NDJSON format validation

Verify every line in the log file is valid JSON with required fields:

```bash
python3 -c "
import sys, json
for i, line in enumerate(open('$LOG_PATH'), 1):
    line = line.strip()
    if not line: continue
    try:
        obj = json.loads(line)
        for field in ('ts', 'level', 'event', 'message'):
            assert field in obj, f'Line {i}: missing required field: {field}'
    except json.JSONDecodeError as e:
        print(f'Line {i}: invalid JSON: {e}')
        sys.exit(1)
print(f'All {i} lines valid NDJSON with required fields')
"
```

### Step 6: JSON mode cleanliness

```bash
node apps/node/dist/cli/index.js snapshot \
  --device <device_serial> \
  --operator-package com.clawperator.operator.dev \
  --format json 2>/dev/null | python3 -m json.tool > /dev/null && echo "PASS: JSON mode stdout is clean" || echo "FAIL: JSON mode stdout is not valid JSON"
```

Must print "PASS". If it prints "FAIL", there are log lines leaking into stdout in JSON mode.

### Step 7: SSE verification

```bash
node apps/node/dist/cli/index.js serve --host 127.0.0.1 --port 3405 --log-level debug &
SERVER_PID=$!
sleep 2
curl -N http://127.0.0.1:3405/events > /tmp/clawperator-sse-final.log &
SSE_PID=$!
sleep 1
curl -s -X POST http://127.0.0.1:3405/snapshot \
  -H 'Content-Type: application/json' \
  -d "{\"deviceId\":\"<device_serial>\",\"operatorPackage\":\"com.clawperator.operator.dev\"}"
sleep 3
kill "$SSE_PID" 2>/dev/null
kill "$SERVER_PID" 2>/dev/null
echo "=== SSE events received ==="
grep 'clawperator:result\|clawperator:execution' /tmp/clawperator-sse-final.log
echo "=== Serve events in log file ==="
grep '"event":"serve\.' "$LOG_PATH" | head -5
```

SSE must still deliver `clawperator:result` and/or `clawperator:execution` events. Serve events must appear in the log file.

### Step 8: Sensitive payload leak check

```bash
python3 -c "
import json
log_path = '$LOG_PATH'
for i, line in enumerate(open(log_path), 1):
    line = line.strip()
    if not line: continue
    obj = json.loads(line)
    msg_len = len(obj.get('message', ''))
    if msg_len > 2000:
        print(f'WARNING: Line {i} event={obj[\"event\"]} has message of {msg_len} chars - possible payload leak')
print('Payload leak check complete')
"
```

No warnings should appear. If they do, investigate which event is leaking large payloads.

### Step 9: Baseline comparison (CRITICAL)

This is the step that proves the core objective of the entire unified logging task is met.

```bash
echo "=== Phase 0 baseline event types ==="
cat tasks/log/unified/runs/phase-0-baseline-log.jsonl | python3 -c "
import sys, json, collections
counts = collections.Counter()
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    counts[json.loads(line)['event']] += 1
for event, count in sorted(counts.items()):
    print(f'  {event}: {count}')
"
echo ""
echo "=== Final log event types (from step 4 skill run) ==="
cat "$LOG_PATH" | python3 -c "
import sys, json, collections
counts = collections.Counter()
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    try:
        counts[json.loads(line)['event']] += 1
    except: pass
for event, count in sorted(counts.items()):
    print(f'  {event}: {count}')
has_output = 'skills.run.output' in counts
has_banner = 'cli.banner' in counts
print(f'\nskills.run.output present: {has_output} (was absent in baseline)')
print(f'cli.banner present: {has_banner} (was absent in baseline)')
if has_output:
    print('GAP CLOSED: skill child-process output is now captured in the log file')
else:
    print('ERROR: gap is still open - skills.run.output events missing')
    sys.exit(1)
"
```

**Required result:** The script must print "GAP CLOSED". If it prints "ERROR", the core objective of this task is not met and you must investigate and fix before proceeding.

### Step 10: `clawperator logs` streaming

```bash
# Start logs streaming
node apps/node/dist/cli/index.js logs &
LOGS_PID=$!
sleep 1

# Run a snapshot to generate new events
node apps/node/dist/cli/index.js snapshot \
  --device <device_serial> \
  --operator-package com.clawperator.operator.dev \
  --format pretty --log-level debug 2>&1 > /dev/null

sleep 2
kill "$LOGS_PID" 2>/dev/null
echo "PASS: clawperator logs streamed events"
```

### Step 11: Docs build

```bash
./scripts/docs_build.sh
```

Must succeed with no errors.

### Step 12: Restore log file

```bash
cat "$LOG_PATH.pre-phase6" "$LOG_PATH" > "$LOG_PATH.merged" 2>/dev/null && mv "$LOG_PATH.merged" "$LOG_PATH" || true
rm -f "$LOG_PATH.pre-phase6"
```

## Handling failures

If any step fails:

1. Investigate the root cause by reading the relevant source files
2. Fix the issue
3. Re-run `npm --prefix apps/node run build && npm --prefix apps/node run test` to confirm the fix does not break tests
4. Commit the fix with a descriptive message: `fix(node): <what you fixed>`
5. Re-run the failed validation step to confirm it passes
6. Continue with the remaining steps

Each fix gets its own commit. Do not batch fixes.

## After all steps pass

### Update status

Update `tasks/log/unified/plan.md` status table:

| Item | Value |
|------|-------|
| State | complete |
| Completed | 0 [DONE], 1 [DONE], 2 [DONE], 3 [DONE], 4 [DONE], 5 [DONE], 6 [DONE] |
| Remaining | (none) |
| Current / Next | (none) |

Update `tasks/log/unified/work-breakdown.md` status table the same way.

### Final commit

If fixes were needed, they are already committed individually. The status update gets its own commit:

```
chore(task): mark unified logging task complete
```

If no fixes were needed, combine the status update with a note:

```
chore(task): mark unified logging task complete - Phase 6 passed without changes
```

### Do not push. Stop after committing.

## Rules

- Use the branch-local build (`node apps/node/dist/cli/index.js`), not the global `clawperator` binary
- Use `--operator-package com.clawperator.operator.dev` for all device commands
- Use the physical device if both physical and emulator are connected
- `npm --prefix apps/node run build` BEFORE every test run. Never in parallel.
- Do not skip any validation step. Run them all, in order.
- Do not push. Do not create a PR. Stop after committing.
