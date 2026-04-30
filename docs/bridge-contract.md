# Bridge Contract

The bridge/content protocol is intentionally small and namespaced.

## Event Names

- content to bridge: `glide:content-message`
- bridge to content: `glide:bridge-message`
- bridge ready: `glide:bridge-ready`

## Request Flow

1. The main-world bridge loads at `document_start`.
2. The bridge patches page `fetch` and `XMLHttpRequest`.
3. The bridge captures known SCALE request headers from real page requests.
4. The isolated content script asks the bridge for request context or a specific SCALE action.
5. The bridge responds through a typed event with either a result or an error.

## Security Rules

- Do not expose arbitrary URL fetch through bridge messages.
- Do not send secrets to the background service worker unless a feature explicitly requires it and has tests.
- Do not persist captured auth/session headers.
- Do not log full auth/session headers.
- Keep message types declared in `packages/shared`.
