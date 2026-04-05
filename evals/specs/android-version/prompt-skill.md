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
skill package. If you choose to emit a skill, output it between these exact
markers:

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

To make the skill replayable, include these optional inline file-content
fields at the top level when needed:

- `skillMarkdown` - the exact Markdown body for `skillFile`
- `scriptContents` - an object whose keys are the script paths from `scripts`
  and whose values are the script source text
- `artifactContents` - an object whose keys are the artifact paths from
  `artifacts` and whose values are the artifact source text

The JSON object should describe a deterministic skill that replays the Android
Settings navigation and returns the Android version in its own output. The
skill's runtime output must include the line:

CLAWPERATOR_EVAL_ANSWER: <version>

Use the numeric Android version only as the `<version>` value.

If you cannot produce a valid skill package, omit the markers entirely.

Constraints:
- Use only Clawperator commands for device interaction. Do not use adb
  shell commands or any other method to read the version.
- Execute Clawperator commands exactly as shell commands using the provided
  base command. Do not reinterpret or rewrite the command structure.
- Reference only the public documentation at $DOCS_URL.
- Use $CLAWPERATOR_CMD as the command to invoke Clawperator
  (e.g. `node /home/user/repo/apps/node/dist/cli/index.js` or `clawperator`).
- Pass --device $DEVICE_SERIAL on every Clawperator command.
- Pass --operator-package $CLAWPERATOR_OPERATOR_PACKAGE on every
  Clawperator command.
