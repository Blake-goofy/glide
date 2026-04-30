# Testing

GLIDE uses automated checks as an architectural guardrail.

## Required Checks

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm check` runs the local merge gate. `pnpm run ci` is kept as an explicit CI-script alias.

## Unit Tests

Use Vitest for:

- shared message contracts
- managed policy parsing
- SCALE request/header helpers
- bridge request capture
- bridge API request construction
- content-script DOM behavior

Use `jsdom` when a test needs browser globals.

## Extension E2E Tests

Use Playwright for lifecycle behavior that cannot be proven with unit tests:

- loading the unpacked extension in Chromium
- content script and main-world bridge startup order
- fixture SCALE pages that make authenticated requests
- feature UI placement on representative SCALE shells

The E2E harness exists early, but the CI gate may start with unit tests and build validation until the bridge spike is stable.
