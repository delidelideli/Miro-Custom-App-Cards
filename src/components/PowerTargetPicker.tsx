import { useState } from 'react';
import type { Card } from '../types';
import { cardLabel } from '../types';

type Step = 'selectTarget' | 'selectCard' | 'showDrawn' | 'selectGive';

interface Props {
  powerType: 'hand-swap' | 'card-swap';
  userId: string;
  boardId: string;
  playerOrder: string[];
  playerNames: Record<string, string>;
  handCounts: Record<string, number>;
  myHand: Card[];
  onDone: () => void;
  onError: (msg: string) => void;
}

export default function PowerTargetPicker({
  powerType, userId, boardId, playerOrder, playerNames, handCounts, myHand, onDone, onError,
}: Props) {
  const [step, setStep] = useState<Step>('selectTarget');
  const [target, setTarget] = useState('');
  const [drawnCard, setDrawnCard] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);

  const others = playerOrder.filter(id => id !== userId);

  async function post(body: object) {
    const idToken = await miro.board.getIdToken();
    const res = await fetch('/api/power-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, boardId, ...body }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error ?? res.statusText);
    }
    return res.json();
  }

  async function handleSelectTarget(targetId: string) {
    setBusy(true);
    try {
      if (powerType === 'hand-swap') {
        await post({ step: 'resolve', targetPlayerId: targetId });
        onDone();
      } else {
        setTarget(targetId);
        setStep('selectCard');
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectCard(cardIndex: number) {
    setBusy(true);
    try {
      const data = await post({ step: 'take', targetPlayerId: target, cardIndex });
      setDrawnCard(data.drawnCard ?? null);
      setStep('showDrawn');
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGiveCard(giveCardId: string) {
    setBusy(true);
    try {
      await post({ step: 'give', giveCardId });
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (step === 'selectTarget') {
    return (
      <div className="power-picker">
        <p className="pp-title">
          {powerType === 'hand-swap'
            ? 'Hand Swap — pick a player to swap hands with'
            : 'Card Swap — pick a player to take from'}
        </p>
        <div className="pp-players">
          {others.map(id => (
            <button key={id} className="btn primary" onClick={() => handleSelectTarget(id)} disabled={busy}>
              {playerNames[id] ?? id} ({handCounts[id] ?? 0} cards)
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'selectCard') {
    const count = handCounts[target] ?? 0;
    return (
      <div className="power-picker">
        <p className="pp-title">Pick one of {playerNames[target] ?? target}'s cards (you can't see them)</p>
        <div className="pp-blind-cards">
          {Array.from({ length: count }, (_, i) => (
            <button key={i} className="card card-blind" onClick={() => handleSelectCard(i)} disabled={busy}>?</button>
          ))}
        </div>
        {count === 0 && <p className="muted">They have no cards!</p>}
      </div>
    );
  }

  if (step === 'showDrawn') {
    return (
      <div className="power-picker">
        <p className="pp-title">You drew:</p>
        <div className="pp-drawn">{drawnCard ? cardLabel(drawnCard) : '—'}</div>
        <p className="pp-hint">Now pick one of your cards to give back.</p>
        <button className="btn primary" onClick={() => setStep('selectGive')}>Choose card to give</button>
      </div>
    );
  }

  return (
    <div className="power-picker">
      <p className="pp-title">Give one of your cards to {playerNames[target] ?? target}</p>
      <div className="pp-give-cards">
        {myHand.map(c => (
          <button key={c.id} className="btn secondary" onClick={() => handleGiveCard(c.id)} disabled={busy}>
            {cardLabel(c)}
          </button>
        ))}
      </div>
    </div>
  );
}
