# Eval Phase 2 Findings

## Claude

Command:

```bash
claude -p "say hello" --output-format stream-json --dangerously-skip-permissions --verbose 2>/dev/null | head -20
```

Observed output:

```json
{"type":"system","subtype":"init","cwd":"<repo_root>","session_id":"66794e30-8cd7-424d-8ed5-472169ade83e","tools":["Task","TaskOutput","Bash","Glob","Grep","ExitPlanMode","Read","Edit","Write","NotebookEdit","WebFetch","TodoWrite","WebSearch","TaskStop","AskUserQuestion","Skill","EnterPlanMode","EnterWorktree","ExitWorktree","CronCreate","CronDelete","CronList","RemoteTrigger","ToolSearch"],"mcp_servers":[{"name":"claude.ai Gmail","status":"pending"},{"name":"claude.ai Google Calendar","status":"pending"}],"model":"claude-sonnet-4-6","permissionMode":"bypassPermissions","slash_commands":["update-config","debug","simplify","batch","loop","schedule","claude-api","compact","context","cost","heapdump","init","pr-comments","release-notes","review","security-review","extra-usage","insights"],"apiKeySource":"none","claude_code_version":"2.1.81","output_style":"default","agents":["general-purpose","statusline-setup","Explore","Plan"],"skills":["update-config","debug","simplify","batch","loop","schedule","claude-api"],"plugins":[],"uuid":"d85c8490-a5a0-436e-b68e-7cadb23abcc1","fast_mode_state":"off"}
{"type":"assistant","message":{"model":"claude-sonnet-4-6","id":"msg_017cv2fmSB8fkMmKoGpANSDu","type":"message","role":"assistant","content":[{"type":"text","text":"Hello! How can I help you today?"}],"stop_reason":null,"stop_sequence":null,"stop_details":null,"usage":{"input_tokens":3,"cache_creation_input_tokens":12066,"cache_read_input_tokens":8329,"cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":12066},"output_tokens":1,"service_tier":"standard","inference_geo":""},"context_management":null},"parent_tool_use_id":null,"session_id":"66794e30-8cd7-424d-8ed5-472169ade83e","uuid":"7c67ca17-afe2-45b9-9c13-24416d90398b"}
{"type":"result","subtype":"success","is_error":false,"duration_ms":2783,"duration_api_ms":2776,"num_turns":1,"result":"Hello! How can I help you today?","stop_reason":"end_turn","session_id":"66794e30-8cd7-424d-8ed5-472169ade83e","total_cost_usd":0.047935200000000004}
```

## Gemini

Command:

```bash
gemini -p "say hello" --output-format stream-json --yolo 2>/dev/null | head -20
```

Observed output:

```json
{"type":"init","timestamp":"2026-04-04T21:59:12.336Z","session_id":"6ce03a47-b6aa-478f-993f-3032fd0da2d4","model":"auto-gemini-3"}
{"type":"message","timestamp":"2026-04-04T21:59:12.338Z","role":"user","content":"say hello"}
{"type":"message","timestamp":"2026-04-04T21:59:17.493Z","role":"assistant","content":"Hello.","delta":true}
{"type":"message","timestamp":"2026-04-04T21:59:17.539Z","role":"assistant","content":" How can I help you with the Clawperator codebase today?","delta":true}
{"type":"result","timestamp":"2026-04-04T21:59:17.657Z","status":"success","stats":{"total_tokens":23645,"input_tokens":23238,"output_tokens":45,"cached":0,"input":23238,"duration_ms":5321,"tool_calls":0}}
```

## Codex

Command:

```bash
codex exec --dangerously-bypass-approvals-and-sandbox --json "say hello" 2>/dev/null | head -20
```

Observed output:

```json
{"type":"thread.started","thread_id":"019d5a82-1087-7f53-b517-7205a59dca81"}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"hello"}}
{"type":"turn.completed","usage":{"input_tokens":14695,"cached_input_tokens":6528,"output_tokens":20}}
```

## Kimi

Command:

```bash
kimi --print --yolo --output-format stream-json --model kimi-code/kimi-for-coding -p "say hello" 2>/dev/null | head -20
```

Observed output:

```json
{"role":"assistant","content":[{"type":"think","think":"The user just wants me to say hello. This is a simple greeting request that I can respond to directly without needing any tools.","encrypted":null},{"type":"text","text":"Hello! 👋 How can I help you today?"}]}
```

## API Usage Issues

- The current public CLI surface uses `open`, not `open-app`. During the
  Gemini live run, the agent repeatedly tried `clawperator open-app ...` and
  then `clawperator action --type open_app ...`, both of which failed with the
  shipped command set. The correct command was visible in
  `node apps/node/dist/cli/index.js --help`:
  `clawperator open <package-id|url|uri> [--device <id>] [--operator-package <pkg>]`
- This is worth keeping in findings because it shows a real prompt-to-API
  mismatch. Future phases should treat these mismatches as input for API/docs
  improvement, not just as agent failures.
