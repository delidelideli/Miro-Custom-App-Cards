import jwt from 'jsonwebtoken';

export interface MiroTokenPayload {
  user: string;   // Miro user ID
  team: string;   // Miro team ID
}

/** Verifies a Miro id token and returns its payload. Throws on invalid token. */
export function verifyMiroToken(idToken: string): MiroTokenPayload {
  const payload = jwt.verify(idToken, process.env.MIRO_CLIENT_SECRET!, {
    algorithms: ['HS256'],
  }) as MiroTokenPayload;
  return payload;
}
