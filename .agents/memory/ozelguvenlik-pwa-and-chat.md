---
name: ÖzelGüvenlik PWA updates & dual chat components
description: Why Android PWA users saw stale versions, and the two-place chat gotcha
---

# Dev URL sleeping → stale PWA on Android
The Replit dev/preview URL (`*.replit.dev`) sleeps when the workspace is inactive. A PWA installed from it can't reach the server to check for updates, so the old service worker falls back to its cache and the user is stuck on an old build forever.

**Why:** All client-side cache-busting (SW skipWaiting, version polling, BUILD_TS) depends on the server being reachable. A sleeping server defeats every mechanism.

**How to apply:** The real fix for "my PWA won't update" is **deploying** (always-on, stable `.replit.app` URL). Treat dev-URL PWA staleness as expected, not a bug to keep patching. Client mitigations live in `index.html` (3 layers: BUILD_TS via Vite `transformIndexHtml`, `/version.json` poll every 15s, SW `controllerchange`/`SW_UPDATED`). `version.json` is written by `vite.config.ts` at startup alongside `sw.js`.

# Two separate chat UIs — keep them in sync
Chat exists in TWO places and a feature added to one is invisible in the other:
- `src/pages/chat.tsx` — full-screen `/sohbet` route
- `src/components/chat-bubble.tsx` — floating widget shown on most pages (the "Topluluk Sohbeti" popup)

**Why:** A whole round of work (moderator purple animation, reply button, clear-chat) was added only to `chat.tsx`, but the user was looking at the bubble widget the entire time and saw no change.

**How to apply:** When changing chat appearance/behavior (role badges, name colors, socket events), update BOTH files. Note socket event naming: server emits `chat:cleared` for bulk clear — make sure listeners match. Moderator styling is purple smoky (`smoke-mod` keyframe, `.badge-mod`/`.name-mod`), admin is blue shimmer.
