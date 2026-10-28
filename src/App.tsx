import { useEffect, useState } from 'react';
import { signInWithMiro, type MiroContext } from './miroAuth';
import { useGameState, useHand } from './useGame';
import Lobby from './screens/Lobby';
import GameScreen from './screens/GameScreen';

type AppPhase = 'loading' | 'ready' | 'error';

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('loading');
  const [ctx, setCtx] = useState<MiroContext | null>(null);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    signInWithMiro()
      .then(c => { setCtx(c); setPhase('ready'); })
      .catch(err => { setAuthError(err.message); setPhase('error'); });
  }, []);

  if (phase === 'loading') return <div className="screen center"><p>Connecting…</p></div>;
  if (phase === 'error')   return <div className="screen center"><p className="error">Auth error: {authError}</p></div>;

  return <GameRouter ctx={ctx!} />;
}

function GameRouter({ ctx }: { ctx: MiroContext }) {
  const game = useGameState(ctx.boardId);
  const hand = useHand(ctx.boardId, ctx.userId);

  if (!game || game.status === 'lobby') {
    return <Lobby boardId={ctx.boardId} userId={ctx.userId} userName={ctx.userName} game={game} />;
  }

  if (game.status === 'playing' || game.status === 'pendingPower' || game.status === 'finished') {
    return <GameScreen boardId={ctx.boardId} userId={ctx.userId} hand={hand} game={game} />;
  }

  return <div className="screen center"><p>Unknown game state.</p></div>;
}
