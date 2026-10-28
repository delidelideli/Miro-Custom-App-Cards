export type CardColor = 'red' | 'blue' | 'green' | 'yellow';

export interface Card {
  id: string;
  color: CardColor;
  number: number;
}
