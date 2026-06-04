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

# Chat auto-scroll: must escape the Layout page scroll
`Layout` wraps pages in `min-h-screen pb-20`, so the **document** scrolls, not any inner div. A messages container using `flex-1 overflow-y-auto` inside that never becomes the scroll target — `el.scrollTop = el.scrollHeight` silently does nothing because the element isn't the thing overflowing.

**Why:** Took several attempts (scrollTop, scrollIntoView, useLayoutEffect) that all failed on mobile/PWA before realizing the page (not the container) was the scroller.

**How to apply:** The full-page chat (`chat.tsx`) container must be `position: fixed` between header and bottom-nav so it owns its own height; messages div needs `flex-1 min-h-0 overflow-y-auto` (the `min-h-0` is mandatory or flex won't let it shrink to scroll); input is `shrink-0`. The bubble widget (`chat-bubble.tsx`) already works because it has a fixed `maxHeight` + `min-h-0`. Make `scrollToBottom` retry (rAF + setTimeout ~60/200ms) so late-loading avatars don't leave it stranded mid-list.

**Bubble vs full-page use DIFFERENT scroll methods — do not unify them.** The bubble popup IS its own overflow container (fixed `flex flex-col` + `maxHeight` + a `flex-1 min-h-0 overflow-y-auto` messages div), so scroll it via `msgContainerRef.current.scrollTop = scrollHeight`. Do NOT use `scrollIntoView` in the bubble: it walks up and scrolls ancestor scrollers too (the canvas iframe / document), which both broke the scrollbar and left messages stuck not-at-bottom. `scrollIntoView` is only the right tool for `chat.tsx` where the *page* is the scroller. Symptom that this regressed: "sohbetler altta kalıyor / scrollbar sorunu" in the bubble.

**Where the user actually tests:** the floating **chat-bubble widget** (`chat-bubble.tsx`), NOT the full `/sohbet` page. Fixes to `chat.tsx` alone won't satisfy "my message doesn't show at the bottom" complaints — always fix the bubble too. The bubble popup must use a **viewport-relative** max-height (`maxHeight: "min(500px, calc(100dvh - 11rem))"`), and its messages div must be `flex-1 min-h-0 overflow-y-auto` with **no fixed `maxHeight`** px. Fixed px heights don't shrink when the mobile keyboard opens, so the input + newest message get pushed below the keyboard/screen — that's the real cause of "sent message not at bottom" on mobile. `dvh` + `interactive-widget=resizes-content` make the popup shrink with the keyboard.

**Critical gotcha:** set the fixed container's `top`/`bottom` via an **inline `style`**, not a Tailwind arbitrary value. `bottom-[calc(70px+env(safe-area-inset-bottom))]` is INVALID CSS — `calc` requires spaces around `+`, and Tailwind won't add them (you'd need underscores). Invalid `bottom` is dropped entirely → container has no bottom edge → height grows with content → overflow never triggers → scroll silently dead. Use `style={{ top: "56px", bottom: "calc(70px + env(safe-area-inset-bottom))" }}`. Viewport meta keeps `viewport-fit=cover` (for `env()` insets) but does **NOT** use `interactive-widget=resizes-content` — that flag reflowed the whole page on keyboard open and fought the bubble popup's fixed positioning/framer-motion, causing a focus loop ("can't type"). It was removed.

# "Mesaj yazılmıyor" can mean the SERVER rejects, not a typing bug
When the user reports chat messages won't send, check the server first: POST `/api/chat/messages` returns **403** when `admin_settings.chat_locked = true` (only admins can post while locked) or when the user's `users.muted_until` is in the future; **429** for the spam cooldown. An admin can flip the chat lock from the admin panel and forget. Confirm via `SELECT chat_locked FROM admin_settings` before touching client code — the "typing bug" was actually the chat being locked.

**Why:** A whole session was spent on keyboard/scroll/focus theories while the real cause was `chat_locked = true` → every send 403'd.

**How to apply:** Frontend should surface the 403 reason clearly (it currently just alerts), but the data fix is `UPDATE admin_settings SET chat_locked = false`.

# Desktop responsiveness
The app was 100% mobile-first: header, `<main>`, and bottom-nav were all hard-capped at `max-w-md` (448px) → on desktop it was a tiny centered strip. Desktop adaptation lives in `layout.tsx` (header + main now `md:max-w-6xl`, a `hidden md:flex` top nav added mirroring the bottom-nav items), `bottom-nav.tsx` (`md:hidden` so the mobile tab bar disappears on desktop), and the list pages (`home.tsx` "Son İlanlar" + `listings.tsx`) which switch `space-y-3` → `md:grid md:grid-cols-2 lg:grid-cols-3`. Keep header and main at the SAME max-width or the logo won't align with content.

# Chat bot is topic-gated, not reply-to-everything
`chat-bot.ts` `shouldReply` only fires for: direct @mention (`@bot`/`@guvenlikbot`, NOT bare "bot"), greetings/thanks (incl. 2-char "sa" — courtesy check must run BEFORE the <3-char length reject), or a relevant-topic regex (security sector, İSG/6331, fire, first aid, 5188, emergencies). Everything else is ignored. OpenAI system prompt + keyword fallback rules mirror these same expertise areas.

**Why:** User explicitly wanted it to stop replying to everything and act as a domain expert.

**How to apply:** When adding bot topics, update BOTH `RELEVANT_TOPIC_RE` (the gate) and the `KEYWORD_RULES`/system prompt (the answers), or the bot will accept a question it has no good reply for.
