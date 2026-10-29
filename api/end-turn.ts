import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/firebaseAdmin';
import { verifyMiroToken } from './_lib/miroAuth';
import { nextActiveTurn } from './_lib/gameHelpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken, boardId } = req.body ?? {};
  if (!idToken || !boardId) return res.status(400).json({ error: 'idToken and boardId required' });

  let payload;
  try { payload = verifyMiroToken(idToken); }
  catch { return res.status(401).json({ error: 'Invalid Miro token' }); }

  const userId = payload.user;
  const gameRef = db.doc(`games/${boardId}`);
  const gameSnap = await gameRef.get();

  if (!gameSnap.exists) return res.status(404).json({ error: 'Game not found' });
  const game = gameSnap.data()!;
  if (game.currentTurn !== userId) return res.status(403).json({ error: 'Not your turn' });

  const order: string[] = game.playerOrder;
  const direction: number = game.turnDirection ?? 1;
  const eliminated: string[] = game.eliminated ?? [];
  const nextTurn = nextActiveTurn(order, userId, direction, eliminated) ?? userId;

  await gameRef.update({ currentTurn: nextTurn, lastPlay: null });

  return res.status(200).json({ ok: true });
}
