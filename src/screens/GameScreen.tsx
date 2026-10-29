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
  const [showRules, setShowRules] = useState(false);
  const revealedRef = useRef('');

  const isMyTurn = game.currentTurn === userId;
  const isEliminated = game.eliminated.includes(userId);
  const currentName = game.playerNames[game.currentTurn ?? ''] ?? game.currentTurn;
  const isPendingMyPower = game.status === 'pendingPower' && game.pendingPower?.playerId === userId;
  const isPendingOtherPower = game.status === 'pendingPower' && game.pendingPower?.playerId !== userId;

  const lp = game.lastPlay;
  const canCallLiar = !!lp && !lp.revealed && lp.playerId !== userId;

  // Active previous claim (cleared after a reveal or at game start)
  const prevClaim = (lp && !lp.revealed) ? lp.claim : null;

  // Whether this card's honest claim matches the previous claim
  function honestMatchesPrev(card: Card): boolean {
    if (!prevClaim || prevClaim.kind !== 'number') return true;
    if (card.kind === 'power') return true;
    return card.color === prevClaim.color || card.number === prevClaim.number;
  }

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
      const data = await callApi('/api/liar', {});
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

      {/* Active claim — visible to all players so they know what must be matched */}
      {prevClaim && !lp?.revealed && (
        <div className="last-claim">
          Last claim: <strong>{claimLabel(prevClaim)}</strong>
          {prevClaim.kind === 'number' && isMyTurn && (
            <span className="match-req"> · must match {prevClaim.color} or {prevClaim.number}</span>
          )}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {/* Liar reveal result */}
      {lp?.revealed && lp.realCard && (
        <div className={`reveal-banner${lp.loser === userId ? ' loser' : ' safe'}`}>
          {lp.loser === lp.playerId
            ? lp.powerGranted
              ? `${game.playerNames[lp.playerId] ?? lp.playerId} was bluffing — caller uses the power!`
              : `${game.playerNames[lp.playerId] ?? lp.playerId} was bluffing!`
            : 'Honest play — wrong call!'
          }
          {lp.loser === userId && ' (that was you)'}
          <div className="reveal-details">
            Claimed: {claimLabel(lp.claim)} → Real: {cardLabel(lp.realCard)}
            {(lp.penaltyCount ?? 0) > 0 && ` · Drew ${lp.penaltyCount} cards`}
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

      {/* Eliminated banner */}
      {isEliminated && (
        <div className="reveal-banner loser">
          You've been eliminated! ({game.handCounts[userId] ?? 0} cards)
          <div className="reveal-details">Too many cards — watching the rest of the game.</div>
        </div>
      )}

      {/* Step 1: honest or bluff chooser */}
      {!isPendingMyPower && !isEliminated && selectedCard && !pickingClaim && (
        <div className="play-chooser">
          <p className="pc-label">Playing: <strong>{cardLabel(selectedCard)}</strong></p>
          {honestMatchesPrev(selectedCard) ? (
            <button className="btn primary" onClick={() => handleConfirmClaim(cardToClaim(selectedCard))} disabled={busy}>
              Play as {cardLabel(selectedCard)}
            </button>
          ) : (
            <p className="muted pc-no-honest">Honest play doesn't match — you must bluff.</p>
          )}
          <button className="btn secondary" onClick={() => setPickingClaim(true)} disabled={busy}>
            {honestMatchesPrev(selectedCard) ? 'Bluff — claim something else' : 'Choose a claim'}
          </button>
          <button className="btn ghost btn-sm" onClick={() => setSelectedCard(null)}>Cancel</button>
        </div>
      )}

      {/* Step 2: claim picker (bluff mode only) */}
      {!isPendingMyPower && !isEliminated && selectedCard && pickingClaim && (
        <ClaimPicker
          card={selectedCard}
          prevClaim={prevClaim}
          onConfirm={handleConfirmClaim}
          onCancel={() => setPickingClaim(false)}
        />
      )}

      {/* Hand */}
      {!isPendingMyPower && !isEliminated && !selectedCard && (
        <>
          <Hand
            cards={hand}
            onPlay={isMyTurn && game.status === 'playing' ? setSelectedCard : undefined}
          />
          {hand.length === 0 && <p className="muted">Your hand is empty.</p>}
        </>
      )}

      {/* Action buttons */}
      {!isEliminated && (
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
      )}

      {/* Hand counts for all players */}
      <div className="hand-counts">
        {game.playerOrder.map(id => {
          const out = game.eliminated.includes(id);
          return (
            <div key={id} className={`hc-row${id === userId ? ' me' : ''}${out ? ' eliminated' : ''}`}>
              <span>{game.playerNames[id] ?? id}{out && ' (out)'}</span>
              <span>{out ? '—' : `${game.handCounts[id] ?? 0} cards`}</span>
            </div>
          );
        })}
      </div>

      <div className="reset-row">
        <button className="btn ghost btn-sm" onClick={handleReset} disabled={busy}>
          Reset Game
        </button>
        <button className="btn ghost btn-sm" onClick={() => setShowRules(true)}>
          Rules
        </button>
      </div>

      {showRules && (
        <div className="rules-overlay">
          <div className="rules-header">
            <strong>Match It or Fake It — Rules</strong>
            <button className="btn ghost btn-sm" onClick={() => setShowRules(false)}>Close</button>
          </div>
          <div className="rules-body">
            <p><strong>Goal:</strong> Empty your hand to win. Reach 16+ cards and you're eliminated. Last player standing also wins.</p>

            <p><strong>On your turn:</strong> Play a card face-down and claim what it is — you can lie or tell the truth. Or draw a card instead to end your turn.</p>

            <p><strong>Matching rule:</strong> Your claim must match the previous card's color or number. Power cards can be played on anything — they bypass the matching rule.</p>

            <p><strong>Calling Liar:</strong> Any other player can call liar before the next turn.</p>
            <ul>
              <li><strong>Caught bluffing (number card):</strong> bluffer draws based on the number — 1–3 draws 2, 4–6 draws 4, 7–8 draws 6.</li>
              <li><strong>Caught bluffing (power card):</strong> caller gets to use that power.</li>
              <li><strong>Wrong call (they were honest):</strong> caller draws half the penalty, rounded up.</li>
            </ul>

            <p><strong>Power Cards:</strong></p>
            <ul>
              <li><strong>SWAP</strong> (orange): Take a card blind from a player, then give one back.</li>
              <li><strong>REV</strong> (teal): Reverse the turn order.</li>
              <li><strong>SKIP</strong> (purple): Skip the next player's turn.</li>
              <li><strong>HAND</strong> (magenta): Swap your entire hand with another player.</li>
            </ul>

            <p><strong>Not in yet:</strong> partial liar calls (call just the color or number wrong), deck reshuffle when the draw pile runs out.</p>
          </div>
        </div>
      )}
    </div>
  );
}
