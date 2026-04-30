# GLIDE

GLIDE is a Chrome Manifest V3 extension by Blake Becker for SCALE workflow enhancements.

The first project goal is to prove the extension architecture before porting features: a main-world bridge must capture authenticated SCALE request context and successfully call `GetSessionInfo` on `/UserAction/ExecProc` from the page runtime.

## Runtime Shape

- background service worker: extension lifecycle, managed policy, storage, diagnostics
- isolated content scripts: DOM integration, UI mounting, page observers, feature enablement
- main-world bridge: request interception, header capture, same-origin SCALE API calls
- shared package: typed messages, SCALE request types, feature flags, policy schema

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
