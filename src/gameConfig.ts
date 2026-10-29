// Central config — change rules here without touching game logic.
export const gameConfig = {
  colors: ['red', 'blue', 'green', 'yellow'] as const,
  numbersPerColor: 8,        // 1–8 per color → 32 number cards
  copiesPerNumberCard: 1,
  powerCards: ['card-swap', 'reverse', 'skip', 'hand-swap'] as const,
  copiesPerPowerCard: 4,     // 4 of each → 16 power cards  (48 total)
  handSize: 6,
  minPlayers: 2,
  maxPlayers: 6,
  penaltyCards: 2,
} as const;
