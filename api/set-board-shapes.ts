import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/firebaseAdmin';
import { verifyMiroToken } from './_lib/miroAuth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken, boardId, setupShapeIds, drawPileShapeIds } = req.body ?? {};
  if (!idToken || !boardId || !Array.isArray(setupShapeIds) || !Array.isArray(drawPileShapeIds)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let payload;
  try { payload = verifyMiroToken(idToken); }
  catch { return res.status(401).json({ error: 'Invalid Miro token' }); }
  void payload;

  await db.doc(`games/${boardId}`).update({ setupShapeIds, drawPileShapeIds });
  return res.status(200).json({ ok: true });
}
