You are an autonomous agent with access to a connected Android device via the
Clawperator CLI. Your task is to determine the Android version running on the
device and return it as your final answer.

Environment:
- Clawperator command: $CLAWPERATOR_CMD
- Operator package: $CLAWPERATOR_OPERATOR_PACKAGE
- Target device serial: $DEVICE_SERIAL
- Clawperator documentation: $DOCS_URL

Instructions:
1. Open Android Settings using the Clawperator CLI. The Android Settings
   app package name is: com.android.settings
2. Navigate within Settings to find the Android version. It is typically
   found under "About phone" or "About device".
   Example path: Settings -> About phone -> Android version.
3. Use the observe-decide-act loop: snapshot the current state, decide
   what to do, execute an action, repeat.
   Concrete workflow:
   1. Take a snapshot of the current UI.
   2. Inspect visible text and elements.
   3. Decide the next action (tap, open app, scroll, or go back).
   4. Execute that action.
   5. Repeat until the Android version is known.
4. When you have determined the Android version, output exactly this line:

   CLAWPERATOR_EVAL_ANSWER: <version>

   where <version> is the numeric version string only (e.g. "15" or "14",
   not "Android 15"). You may revise your answer by outputting the line
   again - the last occurrence is used.

5. If you cannot determine the version within your allowed attempts, output:

   CLAWPERATOR_EVAL_ANSWER: unknown

## Skill Emission (optional but scored)

After determining the Android version, you may also emit a reusable Clawperator
skill package. For this benchmark, skill emission is not a free-form shortcut.
You must use the Pack A discovery-to-proving route first:

1. Check whether an installed runtime skill already matches the Settings/About
   route for `com.android.settings`.
2. If runtime-skill discovery returns no relevant match, inspect the installed
   authoring-workflow front doors with:

   `clawperator authoring-skills list --json`

3. For this benchmark, `skill-author-by-agent-discovery` is the required
   discovery front door. It should decide whether to hand off to
   `skill-author-by-recording` to prove a reusable authored skill for this
   device family.
4. Do not bypass discovery by inventing a direct wrapper skill or a universal
   cross-device Settings skill.
5. If `skill-author-by-agent-discovery` is unavailable, incomplete, or cannot
   truthfully finish the route yet, still return the Android version answer but
   omit the skill markers entirely.

If you do emit a skill, output it between these exact markers:

CLAWPERATOR_SKILL_START
<skill JSON here>
CLAWPERATOR_SKILL_END

The JSON object must be valid UTF-8 JSON and must satisfy the Clawperator
skill registry contract. At minimum, it must include these top-level fields:

- `id`
- `applicationId`
- `intent`
- `summary`
- `path`
- `skillFile`
- `scripts`
- `artifacts`

To make the skill replayable, include these inline file-content
fields at the top level as required by the paths you provide:

- `skillMarkdown` - the exact Markdown body for `skillFile`
- `scriptContents` - an object whose keys are the script paths from `scripts`
  and whose values are the script source text. If `scripts` is non-empty, you
  must provide `scriptContents` for every path listed in `scripts`, or replay
  will fail.
- `artifactContents` - an object whose keys are the artifact paths from
  `artifacts` and whose values are the artifact source text. If `artifacts` is
  non-empty, you must provide `artifactContents` for every path listed in
  `artifacts`, or replay will fail.

The JSON object should describe a target-specific authored skill for the
current device family, rooted at `com.android.settings`, after the required
discovery route completes. Do not emit a direct minimal wrapper that only
prints the answer, and do not emit one universal skill meant to cover every
OEM or Settings variant.

Before emitting the skill block, run one self-test on this same device and make
sure the authored skill emits a valid `SkillResult`.

The authored skill's runtime output must include the line:

CLAWPERATOR_EVAL_ANSWER: <version>

Use the numeric Android version only as the `<version>` value.

If you cannot produce a valid authored skill package through the required
discovery route, omit the markers entirely.

Constraints:
- Use only Clawperator commands for device interaction. Do not use adb
  shell commands or any other method to read the version.
- Execute Clawperator commands exactly as shell commands using the provided
  base command. Do not reinterpret or rewrite the command structure.
- Reference the public documentation at $DOCS_URL as the baseline. If the
  current run exposes repo-local docs and source, you may inspect them too.
- Use $CLAWPERATOR_CMD as the command to invoke Clawperator
  (e.g. `node /home/user/repo/apps/node/dist/cli/index.js` or `clawperator`).
- Pass --device $DEVICE_SERIAL on every Clawperator command.
- Pass --operator-package $CLAWPERATOR_OPERATOR_PACKAGE on every
  Clawperator command.
