# Skills Verification

Date: 2026-02-19

## Structural checks

- Registry/index regeneration: `./scripts/generate_skill_indexes.sh` -> OK
- Shell syntax: `find skills -type f -path '*/scripts/*.sh' -print0 | xargs -0 -n1 bash -n` -> OK
- Node API registry integration check:
  - `CLAWPERATOR_SKILLS_REGISTRY=<clawperator_repo>-skills/skills/skills-registry.json node <clawperator_repo>/apps/node/dist/cli/index.js skills list --output json` -> 10 skills

## Artifact compile checks (via Node API)

- `com.globird.energy.get-usage / usage` -> OK
- `com.google.android.apps.chromecast.app.get-aircon-status / ac-status` (with `AC_TILE_NAME=Master`) -> OK
- `com.solaxcloud.starter.get-battery / battery` -> OK
- `com.theswitchbot.switchbot.get-bedroom-temperature / bedroom-temperature` -> OK

## Live script checks (connected device: `<device_serial>`)

- `get_bedroom_temperature.sh` -> PASS (`Bedroom temperature: 23.7°C`)
- `get_solax_battery.sh` -> PASS (`SolaX battery level: 61.0%`)
- `get_globird_usage.sh` -> PARTIAL (`Could not parse GloBird usage values`, script exit 0)
- `search_woolworths_products.sh "Coke Zero"` -> FAIL (`stage=navigation`, could not focus search)
- `search_coles_products.sh "Coke Zero"` -> FAIL (`stage=navigation`, could not focus search)
- `get_life360_location.sh "Person"` -> FAIL (`person not found`; script listed discovered members)
- `launch_scrcpy_readonly.sh INVALID_SERIAL` -> PASS expected failure (`device not connected/authorized`)
- `capture_settings_overview.sh` -> PASS (`TEXT_BEGIN...TEXT_END` emitted plus `SCREENSHOT|path=...`)

## Notes

- Failures above are runtime-state/app-navigation dependent, not metadata/layout failures.
- Coles/Woolworths and Life360 scripts should be run with app state ready and target person/query values that exist.
