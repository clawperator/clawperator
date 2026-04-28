# Personalized Skills Finalization Items

These items are outside the required PR-1 wrapper sequence or belong to a
personal/downstream surface. They are recorded here so a later owner can act
without reconstructing the audit.

| ID | Owning repo or surface | Path or scope | Required action | Validation |
| --- | --- | --- | --- | --- |
| XREPO-1 | OpenClaw personal workspace | `~/.openclaw/workspace/skills/home-get-solax-battery/` | Replace or retire the older ActionTask-oriented battery skill after `home-battery-get-level` is accepted as the personal wrapper. | `openclaw skills list --eligible --json`; `openclaw skills info home-battery-get-level --json`; safe OpenClaw forward call once a session target is configured. |
| XREPO-2 | OpenClaw personal workspace | `~/.openclaw/workspace/skills/home-get-globird-usage/` | Replace or retire the older ActionTask-oriented GloBird skill after `home-energy-get-yesterday-usage-cost` is accepted as the personal wrapper. | `openclaw skills list --eligible --json`; `openclaw skills info home-energy-get-yesterday-usage-cost --json`; safe OpenClaw forward call once a session target is configured. |
| XREPO-3 | OpenClaw personal workspace | `~/.openclaw/workspace/skills/home-set-aircon/` and `~/.openclaw/workspace/skills/home-get-aircon-status/` | Replace older ActionTask-oriented HVAC guidance with `home-hvac-control` if Phase 4 proves the unified wrapper discoverable and safe enough. | `openclaw skills list --eligible --json`; `openclaw skills info home-hvac-control --json`; safe OpenClaw forward call once a session target is configured. |
| XREPO-4 | `../clawperator-skills` | SolaX, GloBird, Netflix, and AirTouch runtime skill docs | Consider adding a short cross-reference to `docs/skills/personalized.md` after this repo publishes the page. | Sibling repo docs/test workflow; no change in this PR. |
