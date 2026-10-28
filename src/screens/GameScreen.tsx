import { useState, useEffect, useRef } from 'react';
import Hand from '../components/Hand';
import ClaimPicker from '../components/ClaimPicker';
import PowerTargetPicker from '../components/PowerTargetPicker';
import type { GameState } from '../useGame';
import type { Card, Claim } from '../types';
import { cardLabel, claimLabel } from '../types';

interface GameScreenProps {
  boardId: string;
  userId: string;
  hand: Card[];
  game: GameState;
}

export default function GameScreen({ boardId, userId, hand, game }: GameScreenProps) {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [pickingClaim, setPickingClaim] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const revealedRef = useRef('');

  const isMyTurn = game.currentTurn === userId;
  const currentName = game.playerNames[game.currentTurn ?? ''] ?? game.currentTurn;
  const isPendingMyPower = game.status === 'pendingPower' && game.pendingPower?.playerId === userId;
  const isPendingOtherPower = game.status === 'pendingPower' && game.pendingPower?.playerId !== userId;

  const lp = game.lastPlay;
  const canCallLiar = !!lp && !lp.revealed && lp.playerId !== userId;

  // When liar is called and the card is revealed, update the board shape
  useEffect(() => {
    if (!lp?.revealed || !lp.boardItemId || !lp.realCard) return;
    if (revealedRef.current === lp.boardItemId) return;
    revealedRef.current = lp.boardItemId;
    (async () => {
      try {
        const item = await miro.board.getById(lp.boardItemId) as any;
        const claimText = claimLabel(lp.claim);
        const realText = cardLabel(lp.realCard!);
        const wasBluffing = lp.loser === lp.playerId;
        item.content = `Claimed: ${claimText}\nActually: ${realText}`;
        item.style.fillColor = wasBluffing ? '#7b241c' : '#1a5276';
        await item.sync();
      } catch (_) {}
    })();
  }, [lp?.revealed, lp?.boardItemId]);

  async function callApi(endpoint: string, body: object) {
    const idToken = await miro.board.getIdToken();
    const res = await fetch(endpoint, {
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

  function cardToClaim(card: Card): Claim {
    return card.kind === 'number'
      ? { kind: 'number', color: card.color, number: card.number }
      : { kind: 'power', power: card.power };
  }

  function claimMatchesCard(card: Card, claim: Claim): boolean {
    if (card.kind !== claim.kind) return false;
    if (card.kind === 'number' && claim.kind === 'number')
      return card.color === claim.color && card.number === claim.number;
    if (card.kind === 'power' && claim.kind === 'power')
      return card.power === claim.power;
    return false;
  }

  async function handleConfirmClaim(claim: Claim) {
    if (!selectedCard || busy) return;
    const card = selectedCard;
    setSelectedCard(null);
    setPickingClaim(false);
    setBusy(true);
    setError('');

    const isHonest = claimMatchesCard(card, claim);
    const layout = game.boardLayout;
    const jitter = () => (Math.random() - 0.5) * 40;

    let px: number, py: number, content: string, fillColor: string, borderColor: string;
    if (isHonest) {
      px = (layout?.playArea.x ?? 0) + jitter();
      py = (layout?.playArea.y ?? 0) + jitter();
      content = claimLabel(claim);
      fillColor = '#1a5276';
      borderColor = '#2980b9';
    } else {
      const zone = layout?.playerZones[userId];
      px = (zone?.x ?? 0) + jitter();
      py = (zone?.y ?? 480) - 200 + jitter();
      content = 'BLUFF';
      fillColor = '#f39c12';
      borderColor = '#ca6f1e';
    }

    let createdItem: any = null;
    try {
      createdItem = await miro.board.createShape({
        content,
        shape: 'rectangle',
        style: { fillColor, borderColor, borderWidth: 3 },
        x: px,
        y: py,
        width: 120,
        height: 180,
      });

      await callApi('/api/play', { cardId: card.id, claim, boardItemId: createdItem.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      if (createdItem) {
        try { await miro.board.remove(createdItem); } catch (_) {}
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCallLiar() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await callApi('/api/liar', {});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDraw() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await callApi('/api/draw', {});
      if (data.removedShapeId) {
        try {
          const shape = await miro.board.getById(data.removedShapeId);
          if (shape) await miro.board.remove(shape as any);
        } catch (_) {}
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleEndTurn() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await callApi('/api/end-turn', {});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await callApi('/api/reset', {});
      if (data.shapeIdsToRemove?.length) {
        await Promise.all((data.shapeIdsToRemove as string[]).map(async id => {
          try {
            const item = await miro.board.getById(id);
            if (item) await miro.board.remove(item as any);
          } catch (_) {}
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (game.status === 'finished') {
    const winnerName = game.playerNames[game.winner ?? ''] ?? game.winner;
    return (
      <div className="screen game">
        <h2>Match It or Fake It</h2>
        <div className="win-banner">
          {game.winner === userId ? 'You win! 🎉' : `${winnerName} wins!`}
        </div>
        <p className="muted">Thanks for playing!</p>
      </div>
    );
  }

  return (
    <div className="screen game">
      <h2>Match It or Fake It</h2>

      <div className={`turn-banner${isMyTurn ? ' your-turn' : ''}`}>
        {isMyTurn ? 'Your turn' : `${currentName}'s turn`}
        {isPendingOtherPower && <span className="power-resolving"> (resolving power…)</span>}
      </div>

      {error && <p className="error">{error}</p>}

      {/* Liar reveal result */}
      {lp?.revealed && lp.realCard && (
        <div className={`reveal-banner${lp.loser === userId ? ' loser' : ' safe'}`}>
          {lp.loser === lp.playerId
            ? `${game.playerNames[lp.playerId] ?? lp.playerId} was bluffing!`
            : 'Honest play — caller picks up the pile.'
          }
          {lp.loser === userId && ' (that was you)'}
          <div className="reveal-details">
            Claimed: {claimLabel(lp.claim)} → Real: {cardLabel(lp.realCard)}
          </div>
        </div>
      )}

      {/* Power targeting UI (shown instead of hand/claim picker) */}
      {isPendingMyPower && game.pendingPower && (
        <PowerTargetPicker
          powerType={game.pendingPower.type}
          userId={userId}
          boardId={boardId}
          playerOrder={game.playerOrder}
          playerNames={game.playerNames}
          handCounts={game.handCounts}
          myHand={hand}
          onDone={() => setError('')}
          onError={setError}
        />
      )}

      {/* Step 1: honest or bluff chooser */}
      {!isPendingMyPower && selectedCard && !pickingClaim && (
        <div className="play-chooser">
          <p className="pc-label">Playing: <strong>{cardLabel(selectedCard)}</strong></p>
          <button className="btn primary" onClick={() => handleConfirmClaim(cardToClaim(selectedCard))} disabled={busy}>
            Play as {cardLabel(selectedCard)}
          </button>
          <button className="btn secondary" onClick={() => setPickingClaim(true)} disabled={busy}>
            Bluff — claim something else
          </button>
          <button className="btn ghost btn-sm" onClick={() => setSelectedCard(null)}>Cancel</button>
        </div>
      )}

      {/* Step 2: claim picker (bluff mode only) */}
      {!isPendingMyPower && selectedCard && pickingClaim && (
        <ClaimPicker
          card={selectedCard}
          onConfirm={handleConfirmClaim}
          onCancel={() => setPickingClaim(false)}
        />
      )}

      {/* Hand */}
      {!isPendingMyPower && !selectedCard && (
        <>
          <Hand
            cards={hand}
            onPlay={isMyTurn && game.status === 'playing' ? setSelectedCard : undefined}
          />
          {hand.length === 0 && <p className="muted">Your hand is empty.</p>}
        </>
      )}

      {/* Action buttons */}
      <div className="actions">
        {isMyTurn && game.status === 'playing' && (
          <button className="btn secondary" onClick={handleDraw} disabled={busy}>
            Draw Card
          </button>
        )}
        {canCallLiar && (
          <button className="btn danger" onClick={handleCallLiar} disabled={busy}>
            Call Liar!
          </button>
        )}
        {isMyTurn && !isPendingMyPower && (
          <button className="btn ghost" onClick={handleEndTurn} disabled={busy}>
            End Turn
          </button>
        )}
      </div>

      {/* Hand counts for all players */}
      <div className="hand-counts">
        {game.playerOrder.map(id => (
          <div key={id} className={`hc-row${id === userId ? ' me' : ''}`}>
            <span>{game.playerNames[id] ?? id}</span>
            <span>{game.handCounts[id] ?? 0} cards</span>
          </div>
        ))}
      </div>

      <div className="reset-row">
        <button className="btn ghost btn-sm" onClick={handleReset} disabled={busy}>
          Reset Game
        </button>
      </div>
    </div>
  );
}
