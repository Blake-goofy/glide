# Architecture

GLIDE is split into three runtime surfaces with explicit ownership boundaries.

## Background Service Worker

The background service worker owns extension lifecycle work:

- install/update events
- managed policy reads
- local storage migrations
- diagnostics and feature availability
- optional extension action behavior

It does not own authenticated SCALE API calls. Those calls originate from the page runtime through the bridge unless a documented spike proves a background-originated model is reliable.

## Isolated Content Scripts

Content scripts run in Chrome's isolated world. They own integration with the visible page:

- feature enable/disable decisions
- DOM observers
- UI mounting
- page state extraction that does not require page JavaScript globals
- messaging with the bridge and background service worker

Content scripts should not assume that patching `window.fetch` or `XMLHttpRequest` affects SCALE's own JavaScript runtime.

## Main-World Bridge

The bridge runs in the page main world. It owns the network-sensitive behavior:

- patching page `fetch`
- patching page `XMLHttpRequest`
- capturing SCALE auth/session headers from real page traffic
- calling same-origin SCALE endpoints such as `/UserAction/ExecProc`
- returning narrow responses to the isolated content script

The bridge exposes a small typed protocol through DOM events. It should never expose broad arbitrary fetch capability.

## Shared Contracts

`packages/shared` contains all message names, message payload types, SCALE request types, managed policy schema, and feature flags. Runtime boundaries should import from shared contracts instead of redefining strings locally.
