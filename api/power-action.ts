import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/firebaseAdmin';
import { verifyMiroToken } from './_lib/miroAuth';
import { nextActiveTurn, MAX_HAND_SIZE } from './_lib/gameHelpers';
import type { Card } from '../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken, boardId, step, targetPlayerId, cardIndex, giveCardId } = req.body ?? {};
  if (!idToken || !boardId || !step) return res.status(400).json({ error: 'Missing required fields' });

  let payload;
  try { payload = verifyMiroToken(idToken); }
  catch { return res.status(401).json({ error: 'Invalid Miro token' }); }

  const userId = payload.user;
  const gameRef    = db.doc(`games/${boardId}`);
  const gameSnap   = await gameRef.get();

  if (!gameSnap.exists) return res.status(404).json({ error: 'Game not found' });
  const game = gameSnap.data()!;
  if (game.status !== 'pendingPower') return res.status(409).json({ error: 'No pending power action' });
  if (game.pendingPower?.playerId !== userId) return res.status(403).json({ error: 'Not your power to resolve' });

  const order: string[] = game.playerOrder;
  const direction: number = game.turnDirection ?? 1;
  const idx = order.indexOf(userId);
  const nextTurn = order[((idx + direction) % order.length + order.length) % order.length];

  // ── Hand Swap ──────────────────────────────────────────────────────────────
  if (game.pendingPower.type === 'hand-swap') {
    if (!targetPlayerId) return res.status(400).json({ error: 'targetPlayerId required' });
    if (targetPlayerId === userId) return res.status(400).json({ error: 'Cannot swap with yourself' });

    const myRef     = db.doc(`games/${boardId}/hands/${userId}`);
    const theirRef  = db.doc(`games/${boardId}/hands/${targetPlayerId}`);
    const [mySnap, theirSnap] = await Promise.all([myRef.get(), theirRef.get()]);

    const myCards: Card[]    = mySnap.data()?.cards ?? [];
    const theirCards: Card[] = theirSnap.data()?.cards ?? [];

    // After swap: userId gets theirCards, targetPlayerId gets myCards
    const eliminated: string[] = [...(game.eliminated ?? [])];
    if (theirCards.length > MAX_HAND_SIZE && !eliminated.includes(userId)) eliminated.push(userId);
    if (myCards.length > MAX_HAND_SIZE && !eliminated.includes(targetPlayerId)) eliminated.push(targetPlayerId);
    const active = order.filter(id => !eliminated.includes(id));
    const swapStatus = active.length <= 1 ? 'finished' : 'playing';
    const swapWinner = active.length === 1 ? active[0] : null;
    const swapNextTurn = swapStatus === 'finished'
      ? (game.currentTurn as string)
      : (nextActiveTurn(order, userId, direction, eliminated) ?? order[0]);

    const batch = db.batch();
    batch.update(myRef,    { cards: theirCards });
    batch.update(theirRef, { cards: myCards });
    batch.update(gameRef, {
      status: swapStatus,
      winner: swapWinner,
      eliminated,
      currentTurn: swapNextTurn,
      pendingPower: null,
      lastPlay: null,
      [`handCounts.${userId}`]: theirCards.length,
      [`handCounts.${targetPlayerId}`]: myCards.length,
    });
    await batch.commit();
    return res.status(200).json({ ok: true });
  }

  // ── Card Swap — step 1: take a card ───────────────────────────────────────
  if (game.pendingPower.type === 'card-swap' && step === 'take') {
    if (!targetPlayerId || cardIndex === undefined) {
      return res.status(400).json({ error: 'targetPlayerId and cardIndex required' });
    }
    if (targetPlayerId === userId) return res.status(400).json({ error: 'Cannot swap with yourself' });

    const theirRef  = db.doc(`games/${boardId}/hands/${targetPlayerId}`);
    const swapRef   = db.doc(`games/${boardId}/secret/pendingSwap`);
    const theirSnap = await theirRef.get();
    const theirCards: Card[] = theirSnap.data()?.cards ?? [];

    if (cardIndex < 0 || cardIndex >= theirCards.length) {
      return res.status(400).json({ error: 'Invalid card index' });
    }

    const drawnCard = theirCards[cardIndex];
    const newTheirCards = theirCards.filter((_, i) => i !== cardIndex);

    const batch = db.batch();
    batch.update(theirRef, { cards: newTheirCards });
    batch.set(swapRef, { drawnCard, fromPlayerId: targetPlayerId });
    batch.update(gameRef, { [`handCounts.${targetPlayerId}`]: newTheirCards.length });
    await batch.commit();

    // Return the drawn card so the panel can show it to the active player.
    return res.status(200).json({ ok: true, drawnCard });
  }

  // ── Card Swap — step 2: give a card ───────────────────────────────────────
  if (game.pendingPower.type === 'card-swap' && step === 'give') {
    if (!giveCardId) return res.status(400).json({ error: 'giveCardId required' });

    const myRef   = db.doc(`games/${boardId}/hands/${userId}`);
    const swapRef = db.doc(`games/${boardId}/secret/pendingSwap`);
    const [mySnap, swapSnap] = await Promise.all([myRef.get(), swapRef.get()]);

    if (!swapSnap.exists) return res.status(409).json({ error: 'No pending swap found' });

    const { drawnCard, fromPlayerId } = swapSnap.data()!;
    const myCards: Card[] = mySnap.data()?.cards ?? [];
    const giveIdx = myCards.findIndex(c => c.id === giveCardId);
    if (giveIdx === -1) return res.status(400).json({ error: 'Card not in your hand' });

    const cardToGive = myCards[giveIdx];
    const newMyCards = [...myCards.filter((_, i) => i !== giveIdx), drawnCard];
    const theirRef   = db.doc(`games/${boardId}/hands/${fromPlayerId}`);
    const theirSnap  = await theirRef.get();
    const theirCards: Card[] = theirSnap.data()?.cards ?? [];
    const newTheirCards = [...theirCards, cardToGive];

    const batch = db.batch();
    batch.update(myRef,    { cards: newMyCards });
    batch.update(theirRef, { cards: newTheirCards });
    batch.delete(swapRef);
    batch.update(gameRef, {
      status: 'playing',
      currentTurn: nextTurn,
      pendingPower: null,
      lastPlay: null,
      [`handCounts.${userId}`]: newMyCards.length,
      [`handCounts.${fromPlayerId}`]: newTheirCards.length,
    });
    await batch.commit();
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown step' });
}
