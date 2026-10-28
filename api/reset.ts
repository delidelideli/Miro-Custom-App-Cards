import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/firebaseAdmin';
import { verifyMiroToken } from './_lib/miroAuth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken, boardId } = req.body ?? {};
  if (!idToken || !boardId) return res.status(400).json({ error: 'idToken and boardId required' });

  let payload;
  try { payload = verifyMiroToken(idToken); }
  catch { return res.status(401).json({ error: 'Invalid Miro token' }); }
  void payload;

  const gameRef  = db.doc(`games/${boardId}`);
  const gameSnap = await gameRef.get();

  if (!gameSnap.exists) return res.status(200).json({ ok: true, shapeIdsToRemove: [] });

  const game = gameSnap.data()!;
  const players: string[] = game.playerOrder ?? [];

  // Collect every shape ID we ever placed on the board
  const shapeIdsToRemove: string[] = [
    ...(game.setupShapeIds    ?? []),
    ...(game.drawPileShapeIds ?? []),
    ...(game.playedShapeIds   ?? []),
  ].filter(Boolean);

  const batch = db.batch();
  for (const id of players) {
    batch.delete(db.doc(`games/${boardId}/hands/${id}`));
  }
  batch.delete(db.doc(`games/${boardId}/secret/deck`));
  batch.delete(db.doc(`games/${boardId}/secret/pendingSwap`));
  batch.delete(gameRef);
  await batch.commit();

  return res.status(200).json({ ok: true, shapeIdsToRemove });
}
