import { useState } from 'react';
import type { Claim, CardColor, PowerType, Card } from '../types';
import { cardLabel } from '../types';

const COLORS: CardColor[] = ['red', 'blue', 'green', 'yellow'];
const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8];
const POWERS: PowerType[] = ['card-swap', 'reverse', 'skip', 'hand-swap'];
const POWER_LABELS: Record<PowerType, string> = {
  'card-swap': 'Card Swap',
  reverse:     'Reverse',
  skip:        'Skip',
  'hand-swap': 'Hand Swap',
};
const COLOR_HEX: Record<CardColor, string> = {
  red:    '#c0392b',
  blue:   '#2980b9',
  green:  '#27ae60',
  yellow: '#c7a800',
};

interface ClaimPickerProps {
  card: Card;
  prevClaim?: Claim | null;
  onConfirm: (claim: Claim) => void;
  onCancel: () => void;
}

export default function ClaimPicker({ card, prevClaim, onConfirm, onCancel }: ClaimPickerProps) {
  const [tab, setTab] = useState<'number' | 'power'>(card.kind === 'power' ? 'power' : 'number');
  const [color, setColor] = useState<CardColor>(card.kind === 'number' ? card.color : 'red');
  const [num, setNum] = useState(card.kind === 'number' ? card.number : 1);
  const [power, setPower] = useState<PowerType>(card.kind === 'power' ? card.power : 'card-swap');

  // What the previous number claim constrains (null = no constraint)
  const matchColor = prevClaim?.kind === 'number' ? prevClaim.color : null;
  const matchNumber = prevClaim?.kind === 'number' ? prevClaim.number : null;

  // Current selection is valid if it's a power claim, or if it matches by color or number
  const isValid = tab === 'power'
    || matchColor === null
    || color === matchColor
    || num === matchNumber;

  function confirm() {
    if (!isValid) return;
    onConfirm(tab === 'number'
      ? { kind: 'number', color, number: num }
      : { kind: 'power', power });
  }

  return (
    <div className="claim-picker">
      <p className="cp-title">Playing: <strong>{cardLabel(card)}</strong></p>
      {matchColor !== null ? (
        <p className="cp-hint">Must match <strong style={{ color: COLOR_HEX[matchColor] }}>{matchColor}</strong> or <strong>{matchNumber}</strong> — or claim a power card.</p>
      ) : (
        <p className="cp-hint">Pick any claim — your real card stays hidden.</p>
      )}

      <div className="cp-tabs">
        <button className={`cp-tab${tab === 'number' ? ' active' : ''}`} onClick={() => setTab('number')}>Number</button>
        <button className={`cp-tab${tab === 'power'  ? ' active' : ''}`} onClick={() => setTab('power')}>Power</button>
      </div>

      {tab === 'number' && (
        <div className="cp-form">
          <div className="cp-colors">
            {COLORS.map(c => (
              <button
                key={c}
                className={`cp-color-btn${color === c ? ' selected' : ''}${c === matchColor ? ' match-hint' : ''}`}
                style={{ background: COLOR_HEX[c] }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>
          <div className="cp-numbers">
            {NUMBERS.map(n => (
              <button
                key={n}
                className={`cp-num-btn${num === n ? ' selected' : ''}${n === matchNumber ? ' match-hint' : ''}`}
                onClick={() => setNum(n)}
              >{n}</button>
            ))}
          </div>
          {!isValid && (
            <p className="cp-invalid">Pick the highlighted color or number to match.</p>
          )}
        </div>
      )}

      {tab === 'power' && (
        <div className="cp-powers">
          {POWERS.map(p => (
            <button
              key={p}
              className={`cp-power-btn${power === p ? ' selected' : ''}`}
              onClick={() => setPower(p)}
            >{POWER_LABELS[p]}</button>
          ))}
        </div>
      )}

      <div className="cp-actions">
        <button className="btn secondary" onClick={onCancel}>Cancel</button>
        <button className="btn primary" onClick={confirm} disabled={!isValid}>Confirm</button>
      </div>
    </div>
  );
}
