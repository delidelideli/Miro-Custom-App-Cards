import express from 'express';
import type { Request, Response } from 'express';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import authHandler from '../api/auth';
import joinHandler from '../api/join';
import startHandler from '../api/start';

const app = express();
app.use(express.json());

// Wrap Vercel-style handlers so they work with Express for local dev.
// VercelRequest/Response are compatible with Express's req/res shapes.
function wrap(handler: (req: VercelRequest, res: VercelResponse) => unknown) {
  return (req: Request, res: Response) =>
    handler(req as unknown as VercelRequest, res as unknown as VercelResponse);
}

app.post('/api/auth',  wrap(authHandler));
app.post('/api/join',  wrap(joinHandler));
app.post('/api/start', wrap(startHandler));

const PORT = 3001;
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
