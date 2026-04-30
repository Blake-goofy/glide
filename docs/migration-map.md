# Migration Map

The old desktop launcher repository remains a reference for behavior while GLIDE proves the extension architecture.

## Reference Inputs

| Old reference | GLIDE destination |
| --- | --- |
| `apps/launcher/src/page-enhancements/session-strip.ts` | `apps/extension/src/features/session-strip/` plus bridge API helpers |
| `userscripts/arrive-all-totes.user.js` | `apps/extension/src/features/arrive-all-totes/` plus bridge API helpers |
| `apps/launcher/src/lib/session-strip.test.ts` | `apps/extension/tests/session-strip.test.ts` |
| `apps/launcher/src/lib/arrive-all-totes.test.ts` | `apps/extension/tests/arrive-all-totes.test.ts` |
| `packages/shared` | `packages/shared`, rewritten for extension policy and message contracts |
| `configs` | managed policy schema and safe local defaults |
| `reference-material` | docs and fixture inputs as needed |

## Do Not Port

- Tauri runtime
- Rust modules
- Chrome spawning and local profile preparation
- DevTools Protocol injection
- installer and updater flow
- legacy launcher naming or metadata
