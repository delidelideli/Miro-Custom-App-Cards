import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from './firebase';
import type { Card } from './types';

export interface GameState {
  status: 'lobby' | 'playing' | 'finished';
  playerOrder: string[];
  playerNames: Record<string, string>;
  currentTurn: string | null;
  lastPlay: { playerId: string; claim: string; boardItemId: string } | null;
  winner: string | null;
}

/** Subscribes to the top-level game document. Returns null while loading. */
export function useGameState(boardId: string): GameState | null {
  const [state, setState] = useState<GameState | null>(null);

  useEffect(() => {
    const ref = doc(firestore, `games/${boardId}`);
    return onSnapshot(ref, snap => {
      if (snap.exists()) setState(snap.data() as GameState);
    });
  }, [boardId]);

  return state;
}

/** Subscribes to this player's private hand. */
export function useHand(boardId: string, playerId: string): Card[] {
  const [hand, setHand] = useState<Card[]>([]);

  useEffect(() => {
    const ref = doc(firestore, `games/${boardId}/hands/${playerId}`);
    return onSnapshot(ref, snap => {
      if (snap.exists()) setHand((snap.data().cards as Card[]) ?? []);
    });
  }, [boardId, playerId]);

  return hand;
}
