import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from './firebase';
import type { Card, Claim } from './types';

export interface BoardLayout {
  playArea: { x: number; y: number };
  drawPile: { x: number; y: number };
  playerZones: Record<string, { x: number; y: number }>;
}

export interface LastPlay {
  playerId: string;
  cardId: string;
  claim: Claim;
  boardItemId: string;
  revealed: boolean;
  realCard?: Card;
  loser?: string;
}

export interface PendingPower {
  type: 'card-swap' | 'hand-swap';
  playerId: string;
}

export interface GameState {
  status: 'lobby' | 'playing' | 'pendingPower' | 'finished';
  playerOrder: string[];
  playerNames: Record<string, string>;
  turnDirection: number;
  currentTurn: string | null;
  lastPlay: LastPlay | null;
  pendingPower: PendingPower | null;
  handCounts: Record<string, number>;
  playedCounts: Record<string, number>;
  boardLayout: BoardLayout | null;
  winner: string | null;
}

export function useGameState(boardId: string): GameState | null {
  const [state, setState] = useState<GameState | null>(null);
  useEffect(() => {
    const ref = doc(firestore, `games/${boardId}`);
    return onSnapshot(ref, snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      setState({
        status:       d.status       ?? 'lobby',
        playerOrder:  d.playerOrder  ?? [],
        playerNames:  d.playerNames  ?? {},
        turnDirection: d.turnDirection ?? 1,
        currentTurn:  d.currentTurn  ?? null,
        lastPlay:     d.lastPlay     ?? null,
        pendingPower: d.pendingPower ?? null,
        handCounts:   d.handCounts   ?? {},
        playedCounts: d.playedCounts ?? {},
        boardLayout:  d.boardLayout  ?? null,
        winner:       d.winner       ?? null,
      });
    });
  }, [boardId]);
  return state;
}

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
