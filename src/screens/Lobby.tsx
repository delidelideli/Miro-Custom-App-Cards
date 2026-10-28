import { useState } from 'react';
import type { GameState } from '../useGame';
import { gameConfig } from '../gameConfig';

interface LobbyProps {
  boardId: string;
  userId: string;
  userName: string;
  game: GameState | null;
}

export default function Lobby({ boardId, userId, userName, game }: LobbyProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const players = game?.playerNames ?? {};
  const playerOrder = game?.playerOrder ?? [];
  const hasJoined = playerOrder.includes(userId);
  const canStart = playerOrder.length >= gameConfig.minPlayers;

  async function callApi(endpoint: string, extra?: object) {
    setBusy(true);
    setError('');
    try {
      const idToken = await miro.board.getIdToken();
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, boardId, ...extra }),
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

      <div className="actions">
        {!hasJoined && (
          <button
            className="btn primary"
            onClick={() => callApi('/api/join', { playerName: userName })}
            disabled={busy}
          >
            {busy ? 'Joining…' : 'Join'}
          </button>
        )}
        {hasJoined && (
          <button
            className="btn primary"
            onClick={() => callApi('/api/start')}
            disabled={busy || !canStart}
            title={!canStart ? `Need ${gameConfig.minPlayers} players to start` : ''}
          >
            {busy ? 'Starting…' : `Start (${playerOrder.length}/${gameConfig.minPlayers}+)`}
          </button>
        )}
      </div>
    </div>
  );
}
