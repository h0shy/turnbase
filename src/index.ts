import { readFileSync, existsSync } from 'node:fs';

// Load env from Render secret file BEFORE any other imports
const SECRET_FILE = '/etc/secrets/env';
if (existsSync(SECRET_FILE)) {
  for (const line of readFileSync(SECRET_FILE, 'utf-8').split('\n')) {
    const match = line.match(/^(\w+)=["']?(.*?)["']?\s*$/);
    if (match) process.env[match[1]] = match[2];
  }
}

// Dynamic import so env vars are set before store.ts initializes Redis
const { app } = await import('./app.js');
const { serve } = await import('@hono/node-server');

const PORT = parseInt(process.env.PORT ?? '3000', 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`\nTurnbase running on http://localhost:${info.port}`);
  console.log('\nEngines:');
  console.log('  chess v1.0.0');
  console.log('\nEndpoints:');
  console.log('  GET    /');
  console.log('  POST   /sessions');
  console.log('  GET    /sessions/:id');
  console.log('  POST   /sessions/:id/join');
  console.log('  GET    /sessions/:id/observation?playerId=');
  console.log('  POST   /sessions/:id/actions');
  console.log('  GET    /sessions/:id/transcript');
  console.log('  GET    /sessions/:id/receipt/:turn');
});
