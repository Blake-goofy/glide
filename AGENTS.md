# AGENTS.md - AI Contributor Guidelines

This file is the source of truth for AI agents and human contributors working in this repository.

## Project Intent

GLIDE is a Chrome Manifest V3 extension by Blake Becker for SCALE workflow enhancements.

The extension exists to make authenticated SCALE workflows smoother while keeping the runtime model easy to reason about:

- Manifest V3 Chrome extension
- background service worker for lifecycle, policy, storage, and diagnostics
- isolated content scripts for DOM integration, UI mounting, page observers, and feature enablement
- main-world bridge for SCALE request interception, session header capture, and authenticated same-origin SCALE calls
- typed shared message contracts between the background, content scripts, and bridge
- regression tests for every behavior change

The old desktop launcher repository remains a historical reference for behavior and tests only. Do not port Tauri, Rust, Chrome spawning, DevTools Protocol injection, installer flow, local profile management, or legacy launcher naming into this repository.

## Naming And Ownership

- The author is Blake Becker.
- The product name is GLIDE.
- Do not use legacy company, package-scope, or launcher-product naming in new metadata, package names, code namespaces, or generated artifacts.
- Old repository names may appear only in historical notes or contributor discussion when pointing to reference files.

## Design Principles

1. Keep the bridge as the proven path for authenticated SCALE calls. The main-world bridge captures SCALE request headers and calls `/UserAction/ExecProc` from the page runtime.
2. Keep privileged code narrow. Background code handles extension lifecycle and configuration; it should not own SCALE API calls unless a documented design change proves that model reliable.
3. Use typed contracts at boundaries. Messages and settings must go through shared schemas or shared TypeScript types.
4. Keep host permissions tight. Do not add broad host permissions without a written reason in the PR.
5. Tests before features. Every behavior change lands with regression coverage in the same PR.
6. Treat long-lived DOM hooks as hot paths. Scrutinize work attached to `document`, `documentElement`, `body`, global observers, timers, and high-frequency listeners; prefer scoped selectors, batched updates, lazy attachment, and explicit interaction triggers over broad ambient rescans.

## Hard Rules

- MV3 only.
- No dynamic remote code loading.
- No real production hostnames, secrets, access codes, or customer-specific URLs in source control.
- Do not make SCALE API calls from the background service worker unless a documented design change proves that it is safe and reliable.
- All authenticated SCALE API calls must route through one shared bridge API module.
- Do not duplicate request/header capture logic per feature.
- Use Chrome-supported main-world execution (`world: "MAIN"` or `chrome.scripting` with `world: "MAIN"`). Do not inject ad hoc script tags to bypass extension isolation.
- Do not parse managed or local configuration ad hoc. Use `packages/shared` schemas and helpers.
- Do not leave document-wide observers, timers, or high-frequency listeners doing broad rescans when the work can be scoped to relevant nodes, events, or active interactions.
- Do not add a top-level dependency without explaining why in the PR.
- Always add or update tests in the same PR as a behavior change.
- Always use the repo scripts in `package.json`; do not invent one-off build commands.
- Update this file when architecture boundaries or required workflows change.

## Repo Map

```text
extension
  src/background/       # MV3 service worker: lifecycle, policy, storage, diagnostics
  src/content/          # isolated-world DOM integration and feature mounting
  src/bridge/           # main-world SCALE request capture and API calls
  src/features/         # feature modules such as Session Strip and Arrive All Totes
  src/options/          # options UI if needed
  tests/                # extension unit tests and smoke tests

packages/shared
  src/messages.ts       # typed extension message contracts
  src/scale.ts          # SCALE request/session/header types
  src/policy.ts         # managed policy schema and defaults
  src/feature-flags.ts  # shared feature flag names and defaults

docs
  architecture.md       # runtime model and ownership boundaries
  bridge-contract.md    # bridge/content protocol and security notes
  testing.md            # required local and CI verification
```

## How To Run Things Locally

| Task | CLI |
| --- | --- |
| Install dependencies | `pnpm install` |
| Build all packages | `pnpm build` |
| Type-check all packages | `pnpm typecheck` |
| Lint all packages | `pnpm lint` |
| Unit tests | `pnpm test` |
| Full local CI gate | `pnpm check` or `pnpm run ci` |
| Extension E2E smoke tests | `pnpm test:e2e` |

## Recipe: Add A New SCALE Feature

1. Add shared message and SCALE types in `packages/shared` first.
2. Add or update tests for the bridge API and content behavior before completing the feature.
3. Keep authenticated SCALE calls in `extension/src/bridge/`.
4. Keep DOM placement and UI in `extension/src/content/` or `extension/src/features/`.
5. Add Playwright coverage when the feature depends on real extension wiring or page lifecycle timing.
## Commit And PR Conventions

- Use Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`).
- PR descriptions must include a tests added or updated section.
- PR descriptions must justify new dependencies, host permissions, or managed policy schema changes.
- CI must be green before merge.

## Out Of Scope Without Explicit Approval

- Telemetry or analytics
- Dynamic remote configuration delivery outside Chrome managed storage
- Remote code loading
- Broad `<all_urls>` host access
- Tauri, Rust, installer, updater, or Chrome spawning code from the old launcher
