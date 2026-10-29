import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/firebaseAdmin';
import { verifyMiroToken } from './_lib/miroAuth';
import { nextActiveTurn, MAX_HAND_SIZE } from './_lib/gameHelpers';
import type { Card, Claim } from '../src/types';

function claimsMatch(realCard: Card, claim: Claim): boolean {
  if (realCard.kind !== claim.kind) return false;
  if (realCard.kind === 'number' && claim.kind === 'number') {
    return realCard.color === claim.color && realCard.number === claim.number;
  }
  if (realCard.kind === 'power' && claim.kind === 'power') {
    return realCard.power === claim.power;
  }
  return false;
}

// Cards 1-3 → 2, 4-6 → 4, 7-8 → 6
function calcPenalty(card: Card): number {
  if (card.kind !== 'number') return 0;
  if (card.number <= 3) return 2;
  if (card.number <= 6) return 4;
  return 6;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken, boardId } = req.body ?? {};
  if (!idToken || !boardId) return res.status(400).json({ error: 'idToken and boardId required' });

  let payload;
  try { payload = verifyMiroToken(idToken); }
  catch { return res.status(401).json({ error: 'Invalid Miro token' }); }

  const callerId = payload.user;
  const gameRef = db.doc(`games/${boardId}`);
  const deckRef = db.doc(`games/${boardId}/secret/deck`);

  const [gameSnap, deckSnap] = await Promise.all([gameRef.get(), deckRef.get()]);

  if (!gameSnap.exists) return res.status(404).json({ error: 'Game not found' });
  const game = gameSnap.data()!;
  if (!['playing', 'pendingPower'].includes(game.status)) {
    return res.status(409).json({ error: 'Game not in playing state' });
  }
  if (!game.lastPlay) return res.status(409).json({ error: 'No card has been played yet' });
  if (callerId === game.lastPlay.playerId) return res.status(403).json({ error: 'Cannot call liar on yourself' });

  const deckData = deckSnap.data()!;
  const playPile: Card[] = deckData.playPile ?? [];
  if (playPile.length === 0) return res.status(409).json({ error: 'Play pile is empty' });

  const realCard = playPile[playPile.length - 1];
  const honest = claimsMatch(realCard, game.lastPlay.claim as Claim);
  const blufferId = game.lastPlay.playerId as string;

  const order: string[] = game.playerOrder;
  const direction: number = game.turnDirection ?? 1;
  const eliminated: string[] = [...(game.eliminated ?? [])];
  const originalDrawPile: Card[] = deckData.drawPile ?? [];
  let newDrawPile: Card[] = [...originalDrawPile];

  // ── Determine penalty ──────────────────────────────────────────────────────
  let loserId: string;
  let penaltyCards: Card[] = [];
  let pendingPower: object | null = null;
  let newStatus = 'playing';
  let winner: string | null = null;
  let powerGranted = false;

  if (honest) {
    // Wrong call — caller draws half the normal penalty (rounded up)
    loserId = callerId;
    const basePenalty = realCard.kind === 'number' ? calcPenalty(realCard) : 2;
    const halfPenalty = Math.ceil(basePenalty / 2);
    const take = Math.min(halfPenalty, newDrawPile.length);
    penaltyCards = newDrawPile.slice(0, take);
    newDrawPile = newDrawPile.slice(take);
  } else if (realCard.kind === 'power') {
    // Correct call on a power bluff — caller gets to use the power
    loserId = blufferId;
    powerGranted = true;
    pendingPower = { type: realCard.power, playerId: callerId };
    newStatus = 'pendingPower';
  } else {
    // Correct call on a number bluff — bluffer draws penalty based on card number
    loserId = blufferId;
    const penalty = calcPenalty(realCard);
    const take = Math.min(penalty, newDrawPile.length);
    penaltyCards = newDrawPile.slice(0, take);
    newDrawPile = newDrawPile.slice(take);
  }

  // ── Draw pile shape removal if pile emptied ────────────────────────────────
  const shapeIds: string[] = game.drawPileShapeIds ?? [];
  const pileEmptied = originalDrawPile.length > 0 && newDrawPile.length === 0;
  const removedShapeId = pileEmptied ? (shapeIds[0] ?? null) : null;
  const newShapeIds = pileEmptied ? [] : shapeIds;

  // ── Add penalty cards to loser's hand ─────────────────────────────────────
  const loserHandRef = db.doc(`games/${boardId}/hands/${loserId}`);
  const loserHandSnap = await loserHandRef.get();
  const loserHand: Card[] = loserHandSnap.data()?.cards ?? [];
  const newLoserHand = [...loserHand, ...penaltyCards];

  // ── Check elimination ─────────────────────────────────────────────────────
  if (newLoserHand.length > MAX_HAND_SIZE && !eliminated.includes(loserId)) {
    eliminated.push(loserId);
    const active = order.filter(id => !eliminated.includes(id));
    if (active.length <= 1) {
      newStatus = 'finished';
      winner = active[0] ?? null;
    }
  }

  // ── Next turn ─────────────────────────────────────────────────────────────
  const nextTurn = newStatus === 'finished'
    ? (game.currentTurn as string)
    : newStatus === 'pendingPower'
    ? callerId
    : (nextActiveTurn(order, blufferId, direction, eliminated) ?? order[0]);

  const playedCounts: Record<string, number> = {};
  for (const id of order) playedCounts[id] = 0;

  const batch = db.batch();
  batch.update(loserHandRef, { cards: newLoserHand });
  batch.update(deckRef, { drawPile: newDrawPile, playPile: [] });
  batch.update(gameRef, {
    status: newStatus,
    winner,
    eliminated,
    currentTurn: nextTurn,
    pendingPower: pendingPower ?? null,
    playedCounts,
    lastPlay: {
      ...game.lastPlay,
      revealed: true,
      realCard,
      loser: loserId,
      penaltyCount: penaltyCards.length,
      powerGranted,
    },
    [`handCounts.${loserId}`]: newLoserHand.length,
    drawPileShapeIds: newShapeIds,
  });
  await batch.commit();

  return res.status(200).json({ ok: true, honest, loserId, realCard, removedShapeId });
}
