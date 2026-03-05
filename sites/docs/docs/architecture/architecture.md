# Clawperator Target Architecture

## Product Boundary
Clawperator is a local Android execution runtime for operator commands issued by an external LLM/controller (OpenClaw).

## Core Runtime (keep)
- Android app shell (`androidApp`)
- Operator runtime receiver/service path
- Accessibility-driven UI action execution
- Generic action engine and command parsing/validation
- On-device logging/telemetry for action steps

## To Remove During Migration
- Firebase/FCM command transport and backend dependencies
- User/account and app-style launcher UI concerns
- Non-essential rendering/pixel/resource-heavy surfaces
- Non-critical modules not required for operator execution

## Layout Direction
Near-term:
- Keep project buildable while pruning modules incrementally.

Target:
- Android operator app under `/apps/android`
- Node-side integration app under `/apps/node` (deferred, not in current migration)

## Naming Direction
- Final package/application namespace target: `com.clawperator.operator`.
- Rename work happens after major pruning to reduce churn.
