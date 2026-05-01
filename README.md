# GLIDE

GLIDE is a Chrome Manifest V3 extension by Blake Becker for SCALE workflow enhancements.

The extension architecture is now in place and working: the main-world bridge captures authenticated SCALE request context, the isolated content layer mounts feature UI safely, and workstation-level settings control which enhancements are enabled.

See the [GLIDE wiki](https://github.com/Blake-goofy/glide/wiki) for workflow-focused feature documentation with an emphasis on productivity gains and touch-screen station usage.

## Current Features

- [Session Strip](https://github.com/Blake-goofy/glide/wiki/Session-Strip) for active-session visibility and session actions
- [Arrive All Totes](https://github.com/Blake-goofy/glide/wiki/Arrive-All-Totes) workflow action
- [Clickable Rows](https://github.com/Blake-goofy/glide/wiki/Clickable-Rows) for pallet-build style row-to-input flows
- [Units In Tote Numpad](https://github.com/Blake-goofy/glide/wiki/Units-in-Tote-Numpad) for touch-friendly quantity entry
- [ADFS Keyboard](https://github.com/Blake-goofy/glide/wiki/ADFS-Keyboard) overlay for login pages
- [Dark Mode Background Fix](https://github.com/Blake-goofy/glide/wiki/Dark-Mode-Background-Fix) for SCALE dark-theme rendering gaps
- [Grid Copy](https://github.com/Blake-goofy/glide/wiki/Grid-Copy) with middle-click copy, right-click copy menu, and touch long-press copy
- [Glide Settings](https://github.com/Blake-goofy/glide/wiki/Glide-Settings) in the SCALE user menu so features can be enabled or disabled per workstation

## Runtime Shape

- background service worker: extension lifecycle, managed policy, storage, diagnostics
- isolated content scripts: DOM integration, UI mounting, page observers, feature enablement
- main-world bridge: request interception, header capture, same-origin SCALE API calls
- shared package: typed messages, SCALE request types, feature flags, policy schema

GLIDE currently targets SCALE, ADFS, and WarehouseMobile page shells through Manifest V3 content script injection.

## Local Development

```powershell
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Use `pnpm check` for the full local gate.

## Load The Extension

1. Run `pnpm build` from the repo root.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Choose Load unpacked.
5. Select `apps/extension/dist`.

After loading, open a supported SCALE page and use the SCALE user menu to access Glide Settings.

## Project Layout

- `apps/extension`: Manifest V3 extension source, tests, and build output
- `packages/shared`: shared message contracts, SCALE types, and managed policy schema helpers
- `docs`: architecture, bridge contract, and testing guidance

## Local Commands

```powershell
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm check
```

Read `AGENTS.md` before changing architecture or porting features.
