# Device Prep and Runtime Tips

Related runtime/API repository: [clawperator](https://github.com/clawcave/clawperator.git)

## Why This Matters

Most skill failures are environment/state issues, not script syntax issues.

## Device Preparation

1. Keep target apps up to date.
2. Keep Google Play app updates enabled to reduce stale/forced-update interrupt screens.
3. Ensure required permissions/accessibility are already granted for target apps.
4. Keep device unlocked and stable during runs.
5. Avoid concurrent manual interaction while automation is running.

## Runtime Best Practices

- Start from a known app state when skill requires it.
- Use settle delays around navigation-heavy transitions.
- Capture both structured output and screenshots when debugging.
- Treat warning outputs as actionable signals, not silent success.

## Common Failure Modes

- Unexpected modal dialogs (permissions, battery optimization, updates).
- Remote-config UI changes altering selectors/text.
- Partial rendering causing empty/early reads.
- App session/login changes.

## Operational Advice for Agents

- Verify expected text/fields exist before trusting value extraction.
- If critical fields are missing, re-observe and retry with bounded attempts.
- Return explicit uncertainty to the user when signal quality is degraded.
