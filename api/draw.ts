import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/firebaseAdmin';
import { verifyMiroToken } from './_lib/miroAuth';
import type { Card } from '../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken, boardId } = req.body ?? {};
  if (!idToken || !boardId) return res.status(400).json({ error: 'idToken and boardId required' });

  let payload;
  try { payload = verifyMiroToken(idToken); }
  catch { return res.status(401).json({ error: 'Invalid Miro token' }); }

  const userId = payload.user;
  const gameRef = db.doc(`games/${boardId}`);
  const handRef = db.doc(`games/${boardId}/hands/${userId}`);
  const deckRef = db.doc(`games/${boardId}/secret/deck`);

  const [gameSnap, handSnap, deckSnap] = await Promise.all([
    gameRef.get(), handRef.get(), deckRef.get(),
  ]);

  if (!gameSnap.exists) return res.status(404).json({ error: 'Game not found' });
  const game = gameSnap.data()!;
  if (game.status !== 'playing') return res.status(409).json({ error: 'Game not in playing state' });
  if (game.currentTurn !== userId) return res.status(403).json({ error: 'Not your turn' });

  const deckData = deckSnap.data()!;
  const drawPile: Card[] = deckData.drawPile ?? [];
  if (drawPile.length === 0) return res.status(409).json({ error: 'Draw pile is empty' });

  const drawn = drawPile[0];
  const newDrawPile = drawPile.slice(1);
  const newHand: Card[] = [...(handSnap.data()?.cards ?? []), drawn];

  const order: string[] = game.playerOrder;
  const direction: number = game.turnDirection ?? 1;
  const idx = order.indexOf(userId);
  const nextTurn = order[((idx + direction) % order.length + order.length) % order.length];

  const shapeIds: string[] = game.drawPileShapeIds ?? [];
  const removedShapeId = shapeIds.length > 0 ? shapeIds[shapeIds.length - 1] : null;
  const newShapeIds = shapeIds.slice(0, -1);

  const batch = db.batch();
  batch.update(handRef, { cards: newHand });
  batch.update(deckRef, { drawPile: newDrawPile });
  batch.update(gameRef, {
    currentTurn: nextTurn,
    [`handCounts.${userId}`]: newHand.length,
    drawPileShapeIds: newShapeIds,
  });
  await batch.commit();

  return res.status(200).json({ ok: true, removedShapeId });
}
