import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import sessionsRouter from './routes/sessions';
import { listEngines } from './engines/registry';
import { createOpenApiSpec } from './openapi';

export const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.get('/', (c) =>
  c.json({
    name: 'Turnbase',
    description: 'A verifiable interaction runtime for structured multi-party protocols',
    version: '0.1.0',
    engines: listEngines(),
    docs: '/docs',
    spec: '/openapi.json',
    endpoints: {
      'POST /sessions': 'Create a new session',
      'POST /sessions/:id/join': 'Join a session as a participant',
      'GET /sessions/:id': 'Get session summary',
      'GET /sessions/:id/observation?playerId=': 'Get player-scoped state observation',
      'POST /sessions/:id/actions': 'Submit an action',
      'GET /sessions/:id/transcript': 'Get append-only transcript',
      'GET /sessions/:id/receipt/:turn': 'Get signed execution receipt for a turn',
    },
  })
);

app.get('/openapi.json', (c) => {
  const url = new URL(c.req.url);
  return c.json(createOpenApiSpec(`${url.protocol}//${url.host}`));
});

app.get('/docs', swaggerUI({ url: '/openapi.json' }));

app.route('/sessions', sessionsRouter);
