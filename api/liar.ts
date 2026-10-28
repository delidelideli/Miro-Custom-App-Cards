import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/firebaseAdmin';
import { verifyMiroToken } from './_lib/miroAuth';
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
  // If honest: caller is the liar → caller picks up pile
  // If bluffing: player who played is the liar → they pick up pile
  const loserId = honest ? callerId : game.lastPlay.playerId;

  // Move entire play pile to loser's hand
  const loserHandRef = db.doc(`games/${boardId}/hands/${loserId}`);
  const loserHandSnap = await loserHandRef.get();
  const loserHand: Card[] = loserHandSnap.data()?.cards ?? [];
  const newLoserHand = [...loserHand, ...playPile];

  const order: string[] = game.playerOrder;
  const direction: number = game.turnDirection ?? 1;
  const playedIdx = order.indexOf(game.lastPlay.playerId);
  const nextTurn = order[((playedIdx + direction) % order.length + order.length) % order.length];

  const playedCounts: Record<string, number> = {};
  for (const id of order) playedCounts[id] = 0;

  const batch = db.batch();
  batch.update(loserHandRef, { cards: newLoserHand });
  batch.update(deckRef, { playPile: [] });
  batch.update(gameRef, {
    status: 'playing',
    currentTurn: nextTurn,
    pendingPower: null,
    playedCounts,
    lastPlay: {
      ...game.lastPlay,
      revealed: true,
      realCard,
      loser: loserId,
    },
    [`handCounts.${loserId}`]: newLoserHand.length,
  });
  await batch.commit();

  return res.status(200).json({ ok: true, honest, loserId, realCard });
}
