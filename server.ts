import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './server/api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;
  const HOST = '0.0.0.0';

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Mount Enterprise API routes
  app.use('/api', apiRouter);

  // Health check endpoint for container probes
  app.get('/healthz', (req, res) => {
    res.json({ status: 'OK', system: 'MEAAF Enterprise Server' });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  // One HTTP server for everything (pages, /api, and in development the Vite HMR websocket),
  // so only port 3000 is opened.
  const httpServer = http.createServer(app);

  if (!isProduction) {
    // Mount Vite middlewares in development; HMR attaches to httpServer instead of a second port.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static build in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`[MEAAF Enterprise] Server running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[MEAAF Enterprise] Failed to start server:', err);
  process.exit(1);
});
