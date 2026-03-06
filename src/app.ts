import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sessionsRouter from './routes/sessions';
import { listEngines } from './engines/registry';
import { getSignerAddress } from './signing';
import { createOpenApiSpec } from './openapi';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(join(__dirname, '../public/index.html'), 'utf-8');
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

export const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.get('/', (c) => {
  const accept = c.req.header('Accept') ?? '';
  if (accept.includes('text/html')) {
    return c.html(indexHtml);
  }
  return c.json({
    name: 'Turnbase',
    description: 'A verifiable interaction runtime for structured multi-party protocols',
    version: pkg.version,
    signerAddress: getSignerAddress(),
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
  });
});

app.get('/openapi.json', (c) => {
  const url = new URL(c.req.url);
  return c.json(createOpenApiSpec(`${url.protocol}//${url.host}`));
});

app.get('/docs', swaggerUI({ url: '/openapi.json' }));

// ERC-8004 agent identity — domain verification and discovery
app.get('/.well-known/agent-registration.json', (c) => {
  return c.json({
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: 'Turnbase',
    description: 'Verifiable interaction runtime for structured multi-party protocols. Deterministic rule enforcement, per-player observation scoping, and EIP-712 signed receipts.',
    agentRegistry: 'eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    owner: getSignerAddress(),
    services: [
      {
        name: 'API',
        endpoint: 'https://turnbase.app',
        version: pkg.version,
      },
      {
        name: 'OpenAPI',
        endpoint: 'https://turnbase.app/openapi.json',
        version: pkg.version,
      },
    ],
    active: true,
    supportedTrust: ['reputation'],
  });
});

app.route('/sessions', sessionsRouter);
