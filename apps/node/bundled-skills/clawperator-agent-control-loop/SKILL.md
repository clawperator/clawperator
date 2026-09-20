---
name: clawperator-agent-control-loop
description: Run a bounded, provider-neutral observe, decide, act, and verify loop with Clawperator when an Android goal needs adaptive navigation or evidence extraction. Also guides explicitly requested orchestrated skill authoring after bounded discovery.
---

# Clawperator Agent Control Loop

The agent owns decisions and verification. Clawperator is the deterministic
actuator. Start with `clawperator-agent-orientation` to select and check the CLI,
device and Operator; retain that explicit pair on every device command. Discover
runtime skills first and inspect actual goal coverage before choosing this loop.

## Execute the goal

1. Define the outcome, separately required fields and independent success evidence.
   Declare action, observation, elapsed-time and recovery budgets appropriate to
   this goal. Obtain exclusive controller ownership of the selected device.
2. Observe current state. Check source completeness, projection coverage, freshness,
   foreground and relevant label/value or target/container relationships. Keep the
   original response, capture identity and local evidence. A completed command is
   neither a complete observation nor a verified outcome.
3. Choose one bounded next step from current evidence: extract, query, navigate,
   scroll an observed container, answer a specific visual question, or recover.
   Known-good routes guide decisions; observe their intermediate screens. Do not
   treat a package match, missing offscreen label or model confidence as proof.
4. Execute through the selected Clawperator CLI with `--device <device_serial>`
   and `--operator-package <operator_package>`. Check relevant command help.
   Serialize actions; invalidate candidates after transitions or uncertain effects.
5. Observe and verify the destination or changed state. Continue only within the
   declared budgets. Never implicitly replay a mutation when its later snapshot
   failed. Preserve original failures alongside any successful recovery.
6. Return each independently supported result with its UI label, value, capture
   and action/read evidence. Distinguish partial, failed and verified outcomes;
   report failure phase, last useful evidence and remaining unknowns. Stop at a
   blocking sign-in, consent ambiguity, unavailable target or exhausted budget.

## Read only the reference needed

- [Observation and targeting](references/observation.md): incomplete views,
  offscreen/moved controls, nested rows, ambiguous selectors or visual questions.
- [Failure and recovery](references/recovery.md): failed steps, timeouts,
  interruptions, prior effects and retained diagnostics.
- [Delegation and authoring](references/delegation.md): optional model proposals,
  Settings examples, or an explicit request to author an orchestrated skill.

This skill does not require a provider credential. A host agent can decide
locally and use the same evidence and verification requirements.
