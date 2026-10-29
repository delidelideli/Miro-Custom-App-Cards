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
      deck.push({ id: `${initial}${n}`, kind: 'number', color, number: n });
    }
  }
  for (const power of gameConfig.powerCards) {
    for (let i = 0; i < gameConfig.copiesPerPowerCard; i++) {
      deck.push({ id: `${power}-${i}`, kind: 'power', power });
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

function computeBoardLayout(players: string[]) {
  const spacing = 420;
  const totalWidth = players.length * spacing;
  const startX = -(totalWidth / 2) + spacing / 2;
  const playerZones: Record<string, { x: number; y: number }> = {};
  players.forEach((id, i) => {
    playerZones[id] = { x: startX + i * spacing, y: 580 };
  });
  return {
    playArea: { x: 0, y: 0 },
    drawPile: { x: 320, y: -80 },
    playerZones,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken, boardId } = req.body ?? {};
  if (!idToken || !boardId) return res.status(400).json({ error: 'idToken and boardId required' });

  let payload;
  try { payload = verifyMiroToken(idToken); }
  catch { return res.status(401).json({ error: 'Invalid Miro token' }); }

  const gameRef = db.doc(`games/${boardId}`);
  const gameSnap = await gameRef.get();
  if (!gameSnap.exists) return res.status(404).json({ error: 'Game not found' });

  const game = gameSnap.data()!;
  if (game.status !== 'lobby') return res.status(409).json({ error: 'Game already started' });

  const players: string[] = game.playerOrder;
  if (players.length < gameConfig.minPlayers) {
    return res.status(409).json({ error: `Need at least ${gameConfig.minPlayers} players` });
  }

  const deck = shuffle(buildDeck());
  let cursor = 0;
  const hands: Record<string, Card[]> = {};
  const handCounts: Record<string, number> = {};

  for (const id of players) {
    hands[id] = deck.slice(cursor, cursor + gameConfig.handSize);
    handCounts[id] = gameConfig.handSize;
    cursor += gameConfig.handSize;
  }

  const boardLayout = computeBoardLayout(players);
  const playedCounts: Record<string, number> = Object.fromEntries(players.map(id => [id, 0]));

  const batch = db.batch();
  for (const [id, cards] of Object.entries(hands)) {
    batch.set(db.doc(`games/${boardId}/hands/${id}`), { cards });
  }
  batch.set(db.doc(`games/${boardId}/secret/deck`), {
    drawPile: deck.slice(cursor),
    playPile: [],
  });
  batch.update(gameRef, {
    status: 'playing',
    currentTurn: players[0],
    turnDirection: 1,
    lastPlay: null,
    pendingPower: null,
    handCounts,
    playedCounts,
    boardLayout,
    winner: null,
    eliminated: [],
  });
  await batch.commit();

  return res.status(200).json({
    ok: true,
    currentTurn: players[0],
    boardLayout,
    playerNames: game.playerNames,
  });
}
