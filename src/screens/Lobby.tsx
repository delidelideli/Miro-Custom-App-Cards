import { useState } from 'react';
import type { GameState, BoardLayout } from '../useGame';
import type { Card } from '../types';
import { cardLabel } from '../types';
import { gameConfig } from '../gameConfig';

// Colors for player name tags — none overlap with card colors (red/blue/green/yellow)
// or the bluff amber (#f39c12)
const PLAYER_PALETTE = [
  '#e91e63', // pink
  '#00bcd4', // cyan
  '#ff5722', // deep orange
  '#9c27b0', // purple
  '#009688', // teal
  '#607d8b', // slate blue-grey
  '#8d6e63', // warm brown
  '#039be5', // sky blue
];

function pickPlayerColors(count: number): string[] {
  const shuffled = [...PLAYER_PALETTE].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

interface LobbyProps {
  boardId: string;
  userId: string;
  userName: string;
  game: GameState | null;
}

async function removeBoardShapes(ids: string[]) {
  await Promise.all(ids.map(async id => {
    try {
      const item = await miro.board.getById(id);
      if (item) await miro.board.remove(item as any);
    } catch (_) {}
  }));
}

export default function Lobby({ boardId, userId, userName, game }: LobbyProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [setupStatus, setSetupStatus] = useState('');

  const players = game?.playerNames ?? {};
  const playerOrder = game?.playerOrder ?? [];
  const hasJoined = playerOrder.includes(userId);
  const canStart = playerOrder.length >= gameConfig.minPlayers;

  async function handleJoin() {
    setBusy(true);
    setError('');
    try {
      const idToken = await miro.board.getIdToken();
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, boardId, playerName: userName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? res.statusText);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    setBusy(true);
    setError('');
    setSetupStatus('Starting game…');
    try {
      const idToken = await miro.board.getIdToken();
      const res = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, boardId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? res.statusText);
      }
      const data = await res.json();

      setSetupStatus('Setting up board…');
      const { setupShapeIds, drawPileShapeIds } = await setupBoardLayout(
        data.boardLayout,
        data.playerNames,
        data.drawPileOrder ?? [],
        playerOrder,
      );

      setSetupStatus('Saving layout…');
      const token = await miro.board.getIdToken();
      await fetch('/api/set-board-shapes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token, boardId, setupShapeIds, drawPileShapeIds }),
      });
      setSetupStatus('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSetupStatus('');
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setBusy(true);
    setError('');
    try {
      const idToken = await miro.board.getIdToken();
      const res = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, boardId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      if (data.shapeIdsToRemove?.length) {
        await removeBoardShapes(data.shapeIdsToRemove);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen lobby">
      <h2>Match It or Fake It</h2>
      <p className="subtitle">Lobby</p>

      <div className="player-list">
        {playerOrder.length === 0 && <p className="muted">No players yet.</p>}
        {playerOrder.map(id => (
          <div key={id} className="player-row">
            <span>{players[id] ?? id}</span>
            {id === userId && <span className="you-badge">you</span>}
          </div>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {setupStatus && <p className="setup-status">{setupStatus}</p>}

      <div className="actions">
        {!hasJoined && (
          <button className="btn primary" onClick={handleJoin} disabled={busy}>
            {busy ? 'Joining…' : 'Join'}
          </button>
        )}
        {hasJoined && (
          <button
            className="btn primary"
            onClick={handleStart}
            disabled={busy || !canStart}
            title={!canStart ? `Need ${gameConfig.minPlayers} players to start` : ''}
          >
            {busy ? (setupStatus || 'Starting…') : `Start (${playerOrder.length}/${gameConfig.minPlayers}+)`}
          </button>
        )}
        {game && (
          <button className="btn danger" onClick={handleReset} disabled={busy}>
            Reset Game
          </button>
        )}
      </div>
    </div>
  );
}

async function setupBoardLayout(
  layout: BoardLayout,
  playerNames: Record<string, string>,
  drawPileOrder: Card[],
  playerOrder: string[],
): Promise<{ setupShapeIds: string[]; drawPileShapeIds: string[] }> {
  const LABEL_OFFSET = 90;
  const setupShapeIds: string[] = [];
  const playerColors = pickPlayerColors(playerOrder.length);

  // ── Draw Pile label ──────────────────────────────────────────────────────
  const dpLabel = await miro.board.createShape({
    content: 'Draw Pile',
    shape: 'rectangle',
    style: { fillColor: '#2c3e50', borderColor: '#566573', borderWidth: 2 },
    x: layout.drawPile.x,
    y: layout.drawPile.y - LABEL_OFFSET,
    width: 120,
    height: 40,
  });
  setupShapeIds.push(dpLabel.id);

  // ── Play Area label ──────────────────────────────────────────────────────
  const paLabel = await miro.board.createShape({
    content: 'Play Area',
    shape: 'rectangle',
    style: { fillColor: '#1a5276', borderColor: '#2980b9', borderWidth: 2 },
    x: layout.playArea.x,
    y: layout.playArea.y - LABEL_OFFSET,
    width: 160,
    height: 40,
  });
  setupShapeIds.push(paLabel.id);

  // ── Play Area zone box (outline only) ────────────────────────────────────
  const paBox = await miro.board.createShape({
    content: '',
    shape: 'rectangle',
    style: { fillColor: '#ffffff', borderColor: '#bdc3c7', borderWidth: 3 },
    x: layout.playArea.x,
    y: layout.playArea.y,
    width: 300,
    height: 260,
  });
  setupShapeIds.push(paBox.id);

  // ── Per-player zone labels + bluff zone boxes ────────────────────────────
  for (const [i, playerId] of playerOrder.entries()) {
    const pos = layout.playerZones[playerId];
    if (!pos) continue;
    const color = playerColors[i] ?? '#607d8b';

    // Name tag label
    const zoneLabel = await miro.board.createShape({
      content: playerNames[playerId] ?? playerId,
      shape: 'rectangle',
      style: { fillColor: color, borderColor: color, borderWidth: 2 },
      x: pos.x,
      y: pos.y,
      width: 200,
      height: 50,
    });
    setupShapeIds.push(zoneLabel.id);

    // Bluff zone outline box (cards land 200px above the name tag)
    const bluffBox = await miro.board.createShape({
      content: '',
      shape: 'rectangle',
      style: { fillColor: '#ffffff', borderColor: color, borderWidth: 3 },
      x: pos.x,
      y: pos.y - 200,
      width: 260,
      height: 240,
    });
    setupShapeIds.push(bluffBox.id);
  }

  // ── Draw pile card shapes ────────────────────────────────────────────────
  // Created bottom→top so the top card's shape ends up on top in Miro.
  // drawPileShapeIds[last] = top card (what api/draw.ts pops first).
  const drawPileShapeIds: string[] = [];
  for (let i = drawPileOrder.length - 1; i >= 0; i--) {
    const shape = await miro.board.createShape({
      content: cardLabel(drawPileOrder[i]),
      shape: 'rectangle',
      style: { fillColor: '#2c3e50', borderColor: '#85929e', borderWidth: 1 },
      x: layout.drawPile.x,
      y: layout.drawPile.y,
      width: 100,
      height: 150,
    });
    drawPileShapeIds.unshift(shape.id);
  }

  return { setupShapeIds, drawPileShapeIds };
}
