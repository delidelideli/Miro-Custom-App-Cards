// Central config — change rules here without touching game logic.
export const gameConfig = {
  colors: ['red', 'blue', 'green', 'yellow'] as const,
  numbersPerColor: 5,   // cards 1–5 per color → 20 unique cards, 2 copies each = 40-card deck
  copiesPerCard: 2,
  handSize: 7,
  minPlayers: 2,
  maxPlayers: 6,
  penaltyCards: 2,      // cards the liar picks up when caught
} as const;
