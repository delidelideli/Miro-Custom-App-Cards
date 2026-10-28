import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './_lib/firebaseAdmin';
import { verifyMiroToken } from './_lib/miroAuth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken, boardId, playerName } = req.body ?? {};
  if (!idToken || !boardId) return res.status(400).json({ error: 'idToken and boardId required' });

  let payload;
  try {
    payload = verifyMiroToken(idToken);
  } catch {
    return res.status(401).json({ error: 'Invalid Miro token' });
  }

  const userId = payload.user;
  const gameRef = db.doc(`games/${boardId}`);
  const gameSnap = await gameRef.get();

  if (gameSnap.exists) {
    const data = gameSnap.data()!;
    if (data.status !== 'lobby') {
      return res.status(409).json({ error: 'Game already started' });
    }
    if ((data.playerOrder as string[]).length >= 6) {
      return res.status(409).json({ error: 'Game is full' });
    }
    if (!(data.playerOrder as string[]).includes(userId)) {
      await gameRef.update({
        playerOrder: FieldValue.arrayUnion(userId),
        [`playerNames.${userId}`]: playerName ?? userId,
      });
    }
  } else {
    // First player creates the game document.
    await gameRef.set({
      status: 'lobby',
      playerOrder: [userId],
      playerNames: { [userId]: playerName ?? userId },
      currentTurn: null,
      topClaim: null,
      pileCount: 0,
      lastPlay: null,
      winner: null,
    });
  }

  const updated = (await gameRef.get()).data()!;
  return res.status(200).json({
    playerOrder: updated.playerOrder,
    playerNames: updated.playerNames,
  });
}
