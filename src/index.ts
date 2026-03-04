import { serve } from '@hono/node-server';
import { app } from './app';

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
