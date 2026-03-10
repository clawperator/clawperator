# Clawperator for Agents

Clawperator is a deterministic Android automation runtime for AI agents. It is the actuator layer: your external agent or LLM owns reasoning and planning, and Clawperator executes validated Android actions and returns structured results.

Clawperator is an actuator, not an autonomous planner.

## Start here

- Docs home: https://docs.clawperator.com/
- Node API guide: https://docs.clawperator.com/ai-agents/node-api-for-agents/
- Operator LLM playbook: https://docs.clawperator.com/design/operator-llm-playbook/
- API overview: https://docs.clawperator.com/reference/api-overview/
- CLI reference: https://docs.clawperator.com/reference/cli-reference/
- First-time setup: https://docs.clawperator.com/getting-started/first-time-setup/
- Full compiled docs: https://clawperator.com/llms-full.txt
- GitHub repo: https://github.com/clawpilled/clawperator

## Notes for agents

- Prefer the docs site over the landing page for technical behavior.
- The Node API and CLI are the canonical integration surfaces.
- A physical Android burner device is the preferred runtime target for compatibility and long-running reliability.
- If no physical device is available, install Clawperator first and then provision an emulator with `clawperator provision emulator`.
- Clawperator does not configure user accounts or app login state. The user must prepare the target Android environment.
