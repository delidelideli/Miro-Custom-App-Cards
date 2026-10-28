import { signInWithCustomToken } from 'firebase/auth';
import { firebaseAuth } from './firebase';

export interface MiroContext {
  boardId: string;
  userId: string;
  userName: string;
}

/** Signs the panel into Firebase using a Miro id token. Returns board + user info. */
export async function signInWithMiro(): Promise<MiroContext> {
  const [idToken, boardInfo, userInfo] = await Promise.all([
    miro.board.getIdToken(),
    miro.board.getInfo(),
    miro.board.getUserInfo(),
  ]);

  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (!res.ok) throw new Error(`Auth failed: ${await res.text()}`);

  const { firebaseToken } = await res.json();
  await signInWithCustomToken(firebaseAuth, firebaseToken);

  return {
    boardId: boardInfo.id,
    userId: userInfo.id,
    userName: userInfo.name,
  };
}
