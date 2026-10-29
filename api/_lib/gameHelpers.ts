export const MAX_HAND_SIZE = 15;

/**
 * Returns the next active (non-eliminated) player after `from`.
 * With skip=true, advances two active players (for the skip power card).
 */
export function nextActiveTurn(
  order: string[],
  from: string,
  direction: number,
  eliminated: string[],
  skip = false,
): string | null {
  const active = order.filter(id => !eliminated.includes(id));
  if (active.length === 0) return null;
  if (active.length === 1) return active[0];
  const fromIdx = order.indexOf(from);
  let steps = skip ? 2 : 1;
  let result: string | null = null;
  for (let i = 1; i <= order.length && steps > 0; i++) {
    const candidate = order[((fromIdx + direction * i) % order.length + order.length) % order.length];
    if (!eliminated.includes(candidate)) {
      result = candidate;
      steps--;
    }
  }
  return result ?? active[0];
}
