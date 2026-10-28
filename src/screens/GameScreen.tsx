import { useState } from 'react';
import Hand from '../components/Hand';
import type { GameState } from '../useGame';
import type { Card } from '../types';

interface GameScreenProps {
  boardId: string;
  userId: string;
  hand: Card[];
  game: GameState;
}

let playColumn = 0;

export default function GameScreen({ userId, hand, game }: GameScreenProps) {
  const [status, setStatus] = useState('');
  const [placing, setPlacing] = useState(false);

  const isMyTurn = game.currentTurn === userId;
  const currentName = game.playerNames[game.currentTurn ?? ''] ?? game.currentTurn;

  async function handlePlayCard(card: Card) {
    if (placing) return;
    setPlacing(true);
    setStatus('Placing card…');
    try {
      await miro.board.createShape({
        content: '?',
        shape: 'rectangle',
        style: {
          fillColor: '#1a1a2e',
          borderColor: '#4a4a8c',
          borderWidth: 3,
        },
        x: playColumn * 140,
        y: 0,
        width: 120,
        height: 180,
      });
      playColumn += 1;
      setStatus(`Played ${card.color} ${card.number} face-down.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`Error: ${msg}`);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="screen game">
      <h2>Match It or Fake It</h2>

      <div className={`turn-banner ${isMyTurn ? 'your-turn' : ''}`}>
        {isMyTurn ? 'Your turn' : `${currentName}'s turn`}
      </div>

      {status && <p className="status">{status}</p>}

      <Hand cards={hand} onPlay={isMyTurn ? handlePlayCard : undefined} />

      {hand.length === 0 && <p className="muted">Your hand is empty.</p>}
    </div>
  );
}
