import type { VercelRequest, VercelResponse } from '@vercel/node';
import { auth } from './_lib/firebaseAdmin';
import { verifyMiroToken } from './_lib/miroAuth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken } = req.body ?? {};
  if (!idToken) return res.status(400).json({ error: 'idToken required' });

  let payload;
  try {
    payload = verifyMiroToken(idToken);
  } catch {
    return res.status(401).json({ error: 'Invalid Miro token' });
  }

  const firebaseToken = await auth.createCustomToken(payload.user);
  return res.status(200).json({ firebaseToken });
}
