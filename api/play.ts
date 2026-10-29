import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyMiroToken } from './_lib/miroAuth';
import { nextActiveTurn } from './_lib/gameHelpers';
import type { Card, Claim } from '../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken, boardId, cardId, claim, boardItemId } = req.body ?? {};
  if (!idToken || !boardId || !cardId || !claim || !boardItemId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let payload;
  try { payload = verifyMiroToken(idToken); }
  catch { return res.status(401).json({ error: 'Invalid Miro token' }); }

  const userId = payload.user;
  const gameRef  = db.doc(`games/${boardId}`);
  const handRef  = db.doc(`games/${boardId}/hands/${userId}`);
  const deckRef  = db.doc(`games/${boardId}/secret/deck`);

  const [gameSnap, handSnap, deckSnap] = await Promise.all([
    gameRef.get(), handRef.get(), deckRef.get(),
  ]);

  if (!gameSnap.exists) return res.status(404).json({ error: 'Game not found' });
  const game = gameSnap.data()!;
  if (game.status !== 'playing') return res.status(409).json({ error: 'Game not in playing state' });
  if (game.currentTurn !== userId) return res.status(403).json({ error: 'Not your turn' });

  const cards: Card[] = handSnap.data()?.cards ?? [];
  const cardIdx = cards.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return res.status(400).json({ error: 'Card not in hand' });

  const realCard = cards[cardIdx];
  const newHand = cards.filter((_, i) => i !== cardIdx);
  const deckData = deckSnap.data()!;
  const newPlayPile = [...(deckData.playPile ?? []), realCard];

  // Matching rule: number claims must match the previous number claim by color or number.
  // Power claims always bypass matching. After a reveal there is no active previous claim.
  const prevClaim = (game.lastPlay && !game.lastPlay.revealed)
    ? (game.lastPlay.claim as Claim)
    : null;
  const c = claim as Claim;
  if (prevClaim?.kind === 'number' && c.kind === 'number') {
    if (c.color !== prevClaim.color && c.number !== prevClaim.number) {
      return res.status(400).json({
        error: `Claim must match the previous card — same color (${prevClaim.color}) or same number (${prevClaim.number})`,
      });
    }
  }

  const order: string[] = game.playerOrder;
  const eliminated: string[] = game.eliminated ?? [];
  let direction: number = game.turnDirection ?? 1;
  let skip = false;
  let pendingPower: object | null = null;
  let newStatus = 'playing';

  if (realCard.kind === 'power') {
    switch (realCard.power) {
      case 'reverse': direction = -direction; break;
      case 'skip':    skip = true; break;
      case 'card-swap':
      case 'hand-swap':
        pendingPower = { type: realCard.power, playerId: userId };
        newStatus = 'pendingPower';
        break;
    }
  }

  const nextTurn = pendingPower
    ? game.currentTurn
    : (nextActiveTurn(order, userId, direction, eliminated, skip) ?? userId);

  const isWinner = newHand.length === 0 && !pendingPower;

  const batch = db.batch();
  batch.update(handRef, { cards: newHand });
  batch.update(deckRef, { playPile: newPlayPile });
  batch.update(gameRef, {
    status: isWinner ? 'finished' : newStatus,
    currentTurn: nextTurn,
    turnDirection: direction,
    lastPlay: { playerId: userId, cardId, claim: claim as Claim, boardItemId, revealed: false },
    pendingPower: pendingPower ?? null,
    winner: isWinner ? userId : null,
    [`handCounts.${userId}`]: newHand.length,
    [`playedCounts.${userId}`]: (game.playedCounts?.[userId] ?? 0) + 1,
    playedShapeIds: FieldValue.arrayUnion(boardItemId),
  });
  await batch.commit();

  return res.status(200).json({ ok: true });
}
