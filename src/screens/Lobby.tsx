import { useState } from 'react';
import type { GameState, BoardLayout } from '../useGame';
import type { Card } from '../types';
import { cardLabel } from '../types';
import { gameConfig } from '../gameConfig';

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
      );

      setSetupStatus('Saving board layout…');
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

// Returns { setupShapeIds, drawPileShapeIds } for storage in Firestore
async function setupBoardLayout(
  layout: BoardLayout,
  playerNames: Record<string, string>,
  drawPileOrder: Card[],      // index 0 = top card (drawn first)
): Promise<{ setupShapeIds: string[]; drawPileShapeIds: string[] }> {
  const LABEL_OFFSET = 90;
  const setupShapeIds: string[] = [];

  // Draw Pile label — above the card stack
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

  // Play Area label — above where honest cards land
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

  // Player zone labels
  for (const [playerId, pos] of Object.entries(layout.playerZones)) {
    const zoneLabel = await miro.board.createShape({
      content: playerNames[playerId] ?? playerId,
      shape: 'rectangle',
      style: { fillColor: '#4a235a', borderColor: '#7d3c98', borderWidth: 2 },
      x: pos.x,
      y: pos.y,
      width: 200,
      height: 50,
    });
    setupShapeIds.push(zoneLabel.id);
  }

  // Draw pile card shapes — perfectly stacked, bottom card created first so top card ends up on top.
  // drawPileOrder[0] = top card, drawPileOrder[last] = bottom card.
  // We iterate from last→0 so the top card's shape is the final one created (sits on top in Miro).
  // drawPileShapeIds[last] = top card shape (what api/draw.ts pops).
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
    drawPileShapeIds.unshift(shape.id); // keep in same order as drawPileOrder (index 0 = top)
  }

  return { setupShapeIds, drawPileShapeIds };
}
