import express from 'express';
import type { Request, Response } from 'express';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import authHandler from '../api/auth';
import joinHandler from '../api/join';
import startHandler from '../api/start';
import playHandler from '../api/play';
import drawHandler from '../api/draw';
import liarHandler from '../api/liar';
import endTurnHandler from '../api/end-turn';
import powerActionHandler from '../api/power-action';
import resetHandler from '../api/reset';
import setBoardShapesHandler from '../api/set-board-shapes';

const app = express();
app.use(express.json());

// Wrap Vercel-style handlers so they work with Express for local dev.
// VercelRequest/Response are compatible with Express's req/res shapes.
function wrap(handler: (req: VercelRequest, res: VercelResponse) => unknown) {
  return (req: Request, res: Response) =>
    handler(req as unknown as VercelRequest, res as unknown as VercelResponse);
}

app.post('/api/auth',         wrap(authHandler));
app.post('/api/join',         wrap(joinHandler));
app.post('/api/start',        wrap(startHandler));
app.post('/api/play',         wrap(playHandler));
app.post('/api/draw',         wrap(drawHandler));
app.post('/api/liar',         wrap(liarHandler));
app.post('/api/end-turn',     wrap(endTurnHandler));
app.post('/api/power-action', wrap(powerActionHandler));
app.post('/api/reset',            wrap(resetHandler));
app.post('/api/set-board-shapes', wrap(setBoardShapesHandler));

const PORT = 3001;
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
