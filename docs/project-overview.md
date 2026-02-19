# Project Overview

## Service Overview
- Automation system leveraging a permanently powered Android device in the home.
- Uses Android Accessibility APIs to interact with third-party apps.
- Core principle: **"the app is the API."**
- Expands automation of apps and services to apps without official APIs.

## Mission and Product Shape
ActionTask controls third‑party apps by treating the UI as the API. A permanently powered Android device (the “Operator”) uses Android Accessibility APIs to inspect visible UI, map screens into a readable structure, and perform actions such as taps or toggles. A Kotlin backend (the “Conductor”) orchestrates commands and returns results to clients (initially an MCP server).

## High‑Level Architecture
- **Operator app (Android):** long‑running client on a dedicated device. Executes tasks via Accessibility and reports results.
- **Conductor server (Kotlin):** Cloud Run service that accepts requests, enforces policies, orchestrates tasks, and handles error/timeout management.
- **Client layer:** currently an MCP server; later targets include native apps and workflow integrations.

## Kotlin Multiplatform Design
The codebase is Kotlin Multiplatform (KMP). Platform‑agnostic interfaces live in `commonMain`; Android‑specific implementations live in `androidMain` and are suffixed with `Android` and `.android.kt` filenames. Use platform interfaces + platform implementations when touching Android APIs (e.g., `PackageManager` + `PackageManagerAndroid`). Java SDK usage is discouraged in shared code.

## Module Layout (Quick Map)
- `app/`: Android application module.
- `shared/`: KMP modules, organized by core/data/di/domain/presentation/system/test.
- `tooling/`: Gradle/build tooling.
- `scripts/`: common workflows (quality checks, tests, operator debug events).

## Development Notes for AI Agents
- Prefer `Flow` for state and data pipelines; avoid blocking operators (`first`, `single`) unless necessary.
- Tests live in the `shared/test` module; `commonTest` is preferred when possible.
- Commit messages follow Conventional Commits (e.g., `feat:`, `fix:`, `refactor:`).
- The `.cursor/rules/prd-N*.mdc` files are legacy planning artifacts and can be ignored.

## Documentation Home
Project docs should live in `docs/`. Use this folder for onboarding guides, architecture notes, and workflows that help new contributors or AI agents understand context quickly.
