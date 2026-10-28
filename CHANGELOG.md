# Changelog

All changes pushed to GitHub are recorded here.

---

## Push 1 — Milestone 1: Hello Board
**Date:** 2026-10-27

First working version of the app. Panel shows a hardcoded hand of 5 cards and clicking a card places a face-down rectangle on the Miro board.

**What was built:**
- Vite + TypeScript + React scaffold
- Two-page Miro SDK v2 setup: `index.html` registers the toolbar icon (`icon:click`), `panel.html` loads the React UI
- Hardcoded hand of 5 cards (red 1, blue 3, green 2, yellow 5, red 4)
- Clicking a card calls `miro.board.createShape` to place a dark rectangle on the board
- `gameConfig.ts` — central config file for all tunable game rules (deck size, hand size, penalties)
- `src/types.ts` — shared `Card` and `CardColor` types

**SDK quirks discovered:**
- No Flip card widget in SDK v2 — face-down cards use `createShape` instead
- Valid `ShapeStyle` properties: `fillColor`, `borderColor`, `borderWidth` only — `textColor` and `fontSize` are rejected at runtime
- `miro.board.findEmptySpace` returns an object whose properties are not named `x`/`y` — hardcoded position used instead
- `miro.board.getIdToken()` confirmed working as documented

---

## Push 2 — Milestone 2: Private Hands
**Date:** 2026-10-28

Each player now has a real private hand stored in Firestore. Two players on the same board see different hands and cannot read each other's cards.

**What was built:**
- **API endpoints** (Vercel serverless functions in `api/`):
  - `POST /api/auth` — verifies Miro id token, returns a Firebase custom token
  - `POST /api/join` — adds the calling player to the game lobby in Firestore
  - `POST /api/start` — shuffles a 40-card deck, deals 7 cards to each player, writes hands to Firestore
- **Firebase Auth** — panel signs in with a Firebase custom token on open; Firebase UID = Miro user ID
- **Firestore listeners** — panel subscribes live to `games/{boardId}` and `games/{boardId}/hands/{userId}`
- **Lobby screen** — Join button, live player list, Start button (enabled at 2+ players)
- **Game screen** — real hand from Firestore replaces the M1 hardcoded hand; turn banner shows whose turn it is
- **Firestore security rules** — each player can only read their own hand; no client can write anything; `secret/deck` is server-only
- **Local dev setup** — `npm run dev` runs Vite (port 3000) + Express API server (port 3001) via Vite proxy, replacing `vercel dev` which was unreliable on Node 24

**Setup additions:**
- `.env.local` required (see `SETUP.md`)
- Firebase project: **mirocardgame**
- Vercel project: **miro-game-mod**

---
