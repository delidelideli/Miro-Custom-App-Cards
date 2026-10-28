import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/firebaseAdmin';
import { verifyMiroToken } from './_lib/miroAuth';
import { gameConfig } from '../src/gameConfig';
import type { Card } from '../src/types';

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const color of gameConfig.colors) {
    const initial = color[0];
    for (let n = 1; n <= gameConfig.numbersPerColor; n++) {
      for (const copy of ['a', 'b'] as const) {
        deck.push({ id: `${initial}${n}-${copy}`, color, number: n });
      }
    }
  }
  return deck;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken, boardId } = req.body ?? {};
  if (!idToken || !boardId) return res.status(400).json({ error: 'idToken and boardId required' });

  let payload;
  try {
    payload = verifyMiroToken(idToken);
  } catch {
    return res.status(401).json({ error: 'Invalid Miro token' });
  }

  const gameRef = db.doc(`games/${boardId}`);
  const gameSnap = await gameRef.get();

  if (!gameSnap.exists) return res.status(404).json({ error: 'Game not found — someone must join first' });

  const game = gameSnap.data()!;
  if (game.status !== 'lobby') return res.status(409).json({ error: 'Game already started' });

  const players: string[] = game.playerOrder;
  if (players.length < gameConfig.minPlayers) {
    return res.status(409).json({ error: `Need at least ${gameConfig.minPlayers} players` });
  }

  const deck = shuffle(buildDeck());
  const hands: Record<string, Card[]> = {};
  let cursor = 0;

  for (const playerId of players) {
    hands[playerId] = deck.slice(cursor, cursor + gameConfig.handSize);
    cursor += gameConfig.handSize;
  }

  const drawPile = deck.slice(cursor);

  // Write all hands and game state atomically.
  const batch = db.batch();

  for (const [playerId, cards] of Object.entries(hands)) {
    batch.set(db.doc(`games/${boardId}/hands/${playerId}`), { cards });
  }

  batch.set(db.doc(`games/${boardId}/secret/deck`), { drawPile, playPile: [] });

  batch.update(gameRef, {
    status: 'playing',
    currentTurn: players[0],
  });

  await batch.commit();

  return res.status(200).json({ ok: true, currentTurn: players[0] });
}
