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

## Push 3 — Milestone 3: Full Game Loop
**Date:** 2026-10-28

Full playable game with bluffing, power cards, liar calls, a visual Miro board, and reset.

**New API endpoints (`api/`):**
- `POST /api/play` — plays a card from hand with a claim; handles power effects (reverse, skip, card-swap, hand-swap); detects win on empty hand
- `POST /api/draw` — draws the top card from the draw pile; pops the matching board shape ID to remove it visually
- `POST /api/liar` — resolves a liar call; honest play means caller picks up the pile, bluff means player does; reveals the real card on the board shape
- `POST /api/end-turn` — testing button to skip turn without playing
- `POST /api/power-action` — resolves pending power cards: hand-swap (swap full hands), card-swap step `take` (blind draw from target), card-swap step `give` (complete the swap)
- `POST /api/reset` — deletes all Firestore game data and returns all board shape IDs for the client to remove from the Miro board
- `POST /api/set-board-shapes` — saves setup and draw pile shape IDs to Firestore so reset can clean them up later

**Updated API:**
- `api/start.ts` — now builds a 48-card deck (32 number + 16 power), computes per-player board zones, returns `boardLayout`, `playerNames`, and `drawPileOrder`

**New components:**
- `src/components/ClaimPicker.tsx` — two-tab UI (Number / Power) for choosing a bluff claim; initialises to the card's real value so the default is always honest
- `src/components/PowerTargetPicker.tsx` — multi-step UI for resolving power cards: pick target player, pick blind card (card-swap), see what you drew, pick what to give back

**Updated components:**
- `src/components/Hand.tsx` — renders both NumberCards (colour background) and PowerCards (purple, short label)
- `src/screens/GameScreen.tsx` — full game loop: honest/bluff chooser on card click, claim picker, power target picker, liar button, draw button, end turn button, hand counts, win screen, reset with board cleanup; board shapes updated on liar reveal
- `src/screens/Lobby.tsx` — Start now creates all Miro board shapes (zone labels, play area label, draw pile label, stacked draw pile card shapes with real card labels); Reset removes all tracked shapes before wiping Firestore
- `src/App.tsx` — routes `pendingPower` and `finished` states to GameScreen

**Core changes:**
- `src/types.ts` — rewritten as discriminated union (`NumberCard | PowerCard`), `Claim` type, `claimLabel()` and `cardLabel()` helpers
- `src/gameConfig.ts` — 48-card deck config, 4 power types, 5-card starting hand
- `src/useGame.ts` — extended `GameState` with `pendingPower`, `boardLayout`, `handCounts`, `playedCounts`, `winner`, `drawPileShapeIds`, `setupShapeIds`, `playedShapeIds`; Firestore data now gets safe defaults to prevent crashes on stale data

**Board features:**
- Zone labels per player, Play Area label, Draw Pile label — all placed above their respective card areas so played cards don't cover them
- Draw pile is a perfectly stacked set of shapes each labeled with the real card underneath; top card visible, others hidden; shapes removed one-by-one as cards are drawn
- Honest plays → blue shape with card name placed on the Play Area
- Bluff plays → amber shape with "BLUFF" placed above the player's zone label
- Liar reveal updates the board shape colour (red = caught bluffing, blue = honest)
- Full board cleanup on reset — removes all setup, draw pile, and played card shapes

---
