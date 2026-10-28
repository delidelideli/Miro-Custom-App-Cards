# Match It or Fake It — Miro App Build Spec

Oct 27, 2026 · @Connor

## How to use this doc with Claude Code

This doc is the full spec for a custom Miro app that gives each player a private hand in Match It or Fake It. Export it as Markdown, save it in your project folder as `SPEC.md`, then paste the starter prompt from the last section into Claude Code.

- Build one milestone at a time and test each on a real Miro board before moving on.
- Game rules like deck size and penalties go in one config file, so the team can change them later without touching the app code.
- Claude Code writes the code. You handle the accounts (Miro developer team, Firebase, hosting) and testing with your teammates.

## Project overview and goals

The app keeps every player's hand off the shared board, so a player can see only their own cards. Miro has no per-user hiding: board access is all-or-nothing, and hidden frames hide content from everyone. The app works around this by keeping hands in a private backend and showing each hand only in that player's own side panel.

**Project:** Match It or Fake It, a digital bluffing card game for a game pitch (Digital Board Game track). Team: Connor Tyde, Amelie Wilday, Cash Colwell.

**Goals**

1. Each player sees only their own hand.
2. Played cards land face-down on the shared Miro board, and everyone sees them.
3. Any player can call "liar", which reveals the last played card to everyone.
4. Dealing, drawing and turn order happen automatically.

**Non-goals:** accounts beyond Miro sign-in, matchmaking, more than one game per board, and mobile polish.

## Game actions the app must support

The app only has to handle these actions. The exact card rules live in the team's own rules doc, and the server logic can read them from one config file.

- **Deal:** shuffle a deck and deal a private hand to each player.
- **Play face-down:** a player plays a card from their hand face-down and announces a claim (color + number).
- **Call liar:** another player flips the last played card so everyone sees it, and the loser picks up cards.
- **Draw:** a player takes a card from the draw pile.
- **Turns and win:** track whose turn it is and end the game when a hand is empty.

Keep deck size, hand size and penalties in `gameConfig.ts` so the team can change the rules without touching the app code.

## Architecture

The app has four parts. Hands never touch the Miro board. They live in Firestore, and each player's side panel can read only its own hand.

&#91;embedded content: app architecture · panels, server, Firestore, board\]

- **Side panel (Miro Web SDK app):** each player opens it on the board, and it shows only their hand. Miro gives every user their own copy of the panel.
- **Vercel server:** checks who is calling with the Miro id token, enforces the rules, and is the only thing that writes game state.
- **Firestore:** stores hands, the hidden deck and game state, and pushes live updates to each panel.
- **Shared Miro board:** shows what everyone may see: face-down played cards with their claims, the piles, and reveals after a liar call.

## Data model

All game state lives in Firestore under one game document per Miro board. Hands sit in a separate document per player, so security rules can lock each hand to its owner.

| Path | Holds | Who can read | Who can write |
| --- | --- | --- | --- |
| `games/{boardId}` | status (lobby, playing, finished), playerOrder, currentTurn, topClaim, pileCount, lastPlay (playerId, claim, boardItemId), winner | all players in the game | server only |
| `games/{boardId}/hands/{playerId}` | cards: list of {id, color, number} | that player only | server only |
| `games/{boardId}/secret/deck` | drawPile and the real cards in the play pile | nobody (server only) | server only |
| `games/{boardId}/log/{eventId}` | dated events: dealt, played, called liar, result | all players | server only |

**Card:** `{ id: "r4-a", color: "red", number: 4 }`. The id tells apart the two copies of each card.

**Player id:** the Miro user id from `miro.board.getUserInfo()`, linked to a Firebase Auth user (see Security).

**Board link:** each face-down card on the board stores its Firestore play id in the Miro item's metadata, so the app knows which card to flip on a liar call.

## Game flow and features

Every action goes panel → server → Firestore → board. The panel never changes game state on its own, which keeps players from cheating through the browser console.

1. **Join:** a player opens the app panel and clicks Join. The server adds them to `playerOrder`.
2. **Start:** any player clicks Start (2–6 players). The server shuffles, deals 7 to each, and sets the first face-up card. The app draws the table on the board: draw pile, play pile, player name tags.
3. **Hand view:** each panel listens to its own `hands/{playerId}` doc and shows the cards as clickable tiles. A banner shows whose turn it is and the current claim.
4. **Play:** on your turn, pick a card, pick a claim (color + number, limited to legal claims), then click Play. The server moves the card into the secret pile and updates `lastPlay`. The panel then places a face-down card on the board showing the claim text, for example "Claims: Blue 4".
5. **Call liar:** other players' panels show a Liar! button until the next card is played. The server compares the real card to the claim, moves the pile to the loser's hand, and logs the result. Every panel then flips the board card face-up and shows the result.
6. **Draw:** a Draw button on your turn ends your turn.
7. **Win:** an empty hand that survives the liar window ends the game. Everyone sees a winner banner.

**Panel screens:** Lobby (join + start), Hand (cards, claim picker, Play, Draw, Liar!), Game over (winner, Play again).

**Board items the app draws:** a table frame, a draw-pile card back, the face-down played cards (Flip card widget if the SDK supports it, otherwise a card-back image or shape swapped for the face on reveal), and a log text box.

## Tech stack and setup steps

The whole stack runs on free tiers with no credit card: Miro Web SDK, Firebase (Auth + Firestore, Spark plan), and Vercel for hosting and server functions.

| Part | Choice | Why |
| --- | --- | --- |
| App front end | Vite + TypeScript + React, Miro Web SDK v2 | Miro's official app template uses this setup |
| Server logic | Vercel serverless functions (Node) using Firebase Admin SDK | Free with no card, unlike Firebase Cloud Functions, which needs the paid Blaze plan |
| Database | Cloud Firestore with live listeners | Pushes hand and game updates to each panel instantly |
| Auth | Firebase custom tokens, minted by the server after it checks the Miro id token | Proves which Miro user is calling |
| Hosting | Vercel | Miro loads the app from a public HTTPS URL |

**Setup (do these yourself; Claude Code can talk you through each one)**

1. Create a free Miro developer team and a new app in the Miro developer portal. Note the Client ID and Client Secret.
2. In the app settings, set the App URL (`http://localhost:3000` while building, the Vercel URL later) and turn on the `boards:read` and `boards:write` permissions.
3. Install the app to your developer team, then create a test board in that team.
4. Create a Firebase project. Enable Firestore and Authentication. Download a service-account key for the server.
5. Create a Vercel account and connect the project's GitHub repo.
6. Add environment variables in Vercel and in a local `.env` file (never commit it): `MIRO_CLIENT_SECRET`, `FIREBASE_SERVICE_ACCOUNT`, and the public Firebase web config.
7. Invite Amelie and Cash to the developer team so the app shows up for them.

## Build plan by milestone

There are four milestones. Each one ends with something you can test on a real board, and milestone 2 is enough for a pitch demo.

1. **Hello board:** set up the app from Miro's template. The panel shows a hardcoded hand of 5 cards, and clicking one places a face-down card on the board.
   - Done when: it works on localhost on your test board.
2. **Private hands:** add Firebase, Miro id-token checks, Join/Start, a real shuffle and deal, and security rules.
   - Done when: two teammates on the same board each see a different hand, and neither can read the other's in the browser console.
3. **Full game loop:** add turns, the claim picker, Play, Draw, Liar! with the reveal, pile pickup, win detection, and the log.
   - Done when: three players finish a full game with no manual fixes on the board.
4. **Polish:** add your partner's card art, a styled table frame, a turn banner, sounds or animation if wanted, a Play again button, and a Vercel deploy.
   - Done when: it runs from the Vercel URL for all three teammates.

## Security, limitations, testing

A hand is truly private only if the browser never receives other players' cards. The server and Firestore rules enforce that, not the panel UI.

**Security rules**

- Firestore rules: a user can read `hands/{playerId}` only when `request.auth.uid == playerId`. Nobody can read `secret/deck`. Clients can't write anything; every write goes through the Vercel functions.
- The server verifies the Miro id token (`miro.board.getIdToken()`, signed with the app's Client Secret) on every request before it acts.
- The server checks every move: it's your turn, the card is in your hand, and the claim is legal.
- Never store hands in Miro board item metadata or app data. Anyone on the board can read those.

**Known limitations**

- Played cards that are still face-down show only a card back and a claim on the board. The real card stays on the server until it's revealed.
- Board owners can still delete or move the board items by hand. That's fine for a class game, so treat the board as the display and Firestore as the truth.
- Everyone has to be on the Miro developer team where the app is installed, unless you publish it more widely.
- Ask Claude Code to check the current Miro Web SDK docs for whether Flip card widgets can be created through the SDK. If they can't, use the image-swap fallback.

**Testing checklist**

- [ ] Two browsers (or one normal window + one incognito window) signed in as different Miro users show different hands.
- [ ] Reading another player's hand from the browser console fails with a permission error.
- [ ] Playing out of turn is rejected.
- [ ] A liar call on a true claim gives the pile to the caller; on a lie, to the player who played.
- [ ] A full 3-player game reaches a winner.

## Starter prompt to paste into Claude Code

Paste this into Claude Code from your project folder, with `SPEC.md` saved there.

```
Read SPEC.md. It's the spec for a Miro Web SDK app that gives each player a private hand in our bluffing card game, Match It or Fake It.

Build Milestone 1 only. Before you write any code:
1. Check the current Miro Web SDK v2 docs and Miro's app template, and tell me if anything in the spec is out of date (especially creating Flip cards through the SDK and miro.board.getIdToken).
2. List the accounts or settings I need to set up myself, step by step.

Then scaffold the project with Vite + TypeScript + React, build Milestone 1, and tell me how to run it and test it on my Miro board. Explain each step you take so my teammates can follow along. Don't start Milestone 2 until I confirm Milestone 1 works.
```

For later milestones, start a new message with: "Milestone 1 works. Build Milestone N from SPEC.md the same way."
