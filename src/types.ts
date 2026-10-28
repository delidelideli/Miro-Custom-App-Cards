export type CardColor = 'red' | 'blue' | 'green' | 'yellow';
export type PowerType = 'card-swap' | 'reverse' | 'skip' | 'hand-swap';

export interface NumberCard {
  id: string;
  kind: 'number';
  color: CardColor;
  number: number;
}

export interface PowerCard {
  id: string;
  kind: 'power';
  power: PowerType;
}

export type Card = NumberCard | PowerCard;

export type Claim =
  | { kind: 'number'; color: CardColor; number: number }
  | { kind: 'power'; power: PowerType };

export function claimLabel(claim: Claim): string {
  if (claim.kind === 'number') {
    return `${claim.color[0].toUpperCase()}${claim.color.slice(1)} ${claim.number}`;
  }
  const labels: Record<PowerType, string> = {
    'card-swap': 'Card Swap',
    reverse: 'Reverse',
    skip: 'Skip',
    'hand-swap': 'Hand Swap',
  };
  return labels[claim.power];
}

export function cardLabel(card: Card): string {
  if (card.kind === 'number') return claimLabel({ kind: 'number', color: card.color, number: card.number });
  return claimLabel({ kind: 'power', power: card.power });
}
