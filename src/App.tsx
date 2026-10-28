import { useState } from 'react';
import type { Card } from './types';
import Hand from './components/Hand';

// Hardcoded for Milestone 1 — replaced by live Firestore hand in Milestone 2.
// Each played card steps 140px right so they don't stack on the board.
let playColumn = 0;

const HARDCODED_HAND: Card[] = [
  { id: 'r1-a', color: 'red',    number: 1 },
  { id: 'b3-a', color: 'blue',   number: 3 },
  { id: 'g2-a', color: 'green',  number: 2 },
  { id: 'y5-a', color: 'yellow', number: 5 },
  { id: 'r4-a', color: 'red',    number: 4 },
];

export default function App() {
  const [hand, setHand] = useState<Card[]>(HARDCODED_HAND);
  const [status, setStatus] = useState('Click a card to play it face-down.');
  const [placing, setPlacing] = useState(false);

  async function handlePlayCard(card: Card) {
    if (placing) return;
    setPlacing(true);
    setStatus('Placing card on board…');

    try {
      // No Flip card widget in SDK v2 — dark rectangle is the card back.
      // Milestone 3 will swap this shape for an image on reveal.
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

      setHand(prev => prev.filter(c => c.id !== card.id));
      setStatus(`Played ${card.color} ${card.number} face-down.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[M1] createShape failed:', err);
      setStatus(`Error: ${msg}`);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="app">
      <h2>Match It or Fake It</h2>
      <p className="status">{status}</p>
      <Hand cards={hand} onPlay={handlePlayCard} />
      {hand.length === 0 && (
        <p className="empty">Hand empty — reload the panel to reset (M1 hardcoded hand).</p>
      )}
    </div>
  );
}
