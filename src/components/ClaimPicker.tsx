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
  onConfirm: (claim: Claim) => void;
  onCancel: () => void;
}

export default function ClaimPicker({ card, onConfirm, onCancel }: ClaimPickerProps) {
  const [tab, setTab] = useState<'number' | 'power'>(card.kind === 'power' ? 'power' : 'number');
  const [color, setColor] = useState<CardColor>(card.kind === 'number' ? card.color : 'red');
  const [num, setNum] = useState(card.kind === 'number' ? card.number : 1);
  const [power, setPower] = useState<PowerType>(card.kind === 'power' ? card.power : 'card-swap');

  function confirm() {
    onConfirm(tab === 'number'
      ? { kind: 'number', color, number: num }
      : { kind: 'power', power });
  }

  return (
    <div className="claim-picker">
      <p className="cp-title">Playing: <strong>{cardLabel(card)}</strong></p>
      <p className="cp-hint">Pick any claim — your real card stays hidden.</p>

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
                className={`cp-color-btn${color === c ? ' selected' : ''}`}
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
                className={`cp-num-btn${num === n ? ' selected' : ''}`}
                onClick={() => setNum(n)}
              >{n}</button>
            ))}
          </div>
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
        <button className="btn primary" onClick={confirm}>Confirm</button>
      </div>
    </div>
  );
}
