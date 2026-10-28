import type { Card } from '../types';

const BG: Record<string, string> = {
  red: '#c0392b',
  blue: '#2980b9',
  green: '#27ae60',
  yellow: '#d4ac0d',
};

interface HandProps {
  cards: Card[];
  onPlay?: (card: Card) => void;  // undefined = not your turn, cards shown greyed
}

export default function Hand({ cards, onPlay }: HandProps) {
  if (cards.length === 0) return null;

  return (
    <div className="hand">
      {cards.map(card => (
        <button
          key={card.id}
          className="card"
          style={{ backgroundColor: BG[card.color], opacity: onPlay ? 1 : 0.5 }}
          onClick={() => onPlay?.(card)}
          disabled={!onPlay}
          title={onPlay ? `Play ${card.color} ${card.number} face-down` : "Not your turn"}
        >
          <span className="card-number">{card.number}</span>
          <span className="card-color">{card.color}</span>
        </button>
      ))}
    </div>
  );
}
