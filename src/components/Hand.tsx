import type { Card } from '../types';

const NUMBER_BG: Record<string, string> = {
  red:    '#c0392b',
  blue:   '#2980b9',
  green:  '#27ae60',
  yellow: '#c7a800',
};

const POWER_BG: Record<string, string> = {
  'card-swap': '#e65100',  // deep orange
  'reverse':   '#006064',  // dark teal
  'skip':      '#6a1b9a',  // deep purple
  'hand-swap': '#880e4f',  // dark magenta
};

const POWER_SHORT: Record<string, string> = {
  'card-swap': 'SWAP',
  reverse:     'REV',
  skip:        'SKIP',
  'hand-swap': 'HAND',
};

interface HandProps {
  cards: Card[];
  onPlay?: (card: Card) => void;
}

export default function Hand({ cards, onPlay }: HandProps) {
  if (cards.length === 0) return null;

  return (
    <div className="hand">
      {cards.map(card => {
        const bg   = card.kind === 'number' ? NUMBER_BG[card.color] : (POWER_BG[card.power] ?? '#6a1b9a');
        const main = card.kind === 'number' ? String(card.number)   : (POWER_SHORT[card.power] ?? card.power);
        const sub  = card.kind === 'number' ? card.color            : 'POWER';
        return (
          <button
            key={card.id}
            className="card"
            style={{ backgroundColor: bg, opacity: onPlay ? 1 : 0.5 }}
            onClick={() => onPlay?.(card)}
            disabled={!onPlay}
            title={onPlay ? `Play ${main}` : 'Not your turn'}
          >
            <span className="card-number">{main}</span>
            <span className="card-color">{sub}</span>
          </button>
        );
      })}
    </div>
  );
}
