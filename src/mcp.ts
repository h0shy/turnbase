#!/usr/bin/env node
/**
 * Turnbase MCP Server
 *
 * Exposes Turnbase game sessions as MCP tools so AI assistants
 * can create and play structured games with cryptographic receipts.
 *
 * Testing with Claude Desktop — add to:
 *   ~/Library/Application Support/Claude/claude_desktop_config.json
 *
 *   {
 *     "mcpServers": {
 *       "turnbase": {
 *         "command": "npx",
 *         "args": ["tsx", "/absolute/path/to/turnbase/src/mcp.ts"]
 *       }
 *     }
 *   }
 *
 * Or after `npm install -g turnbase`:
 *   { "mcpServers": { "turnbase": { "command": "turnbase-mcp" } } }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const BASE = process.env.TURNBASE_URL ?? 'https://turnbase.onrender.com';

async function api(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const server = new Server(
  { name: 'turnbase', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_engines',
      description: 'List available game engines on Turnbase.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'create_session',
      description:
        'Create a new game session. Returns a sessionId players use to join. ' +
        'Two players must join before the game starts.',
      inputSchema: {
        type: 'object',
        required: ['engine'],
        properties: {
          engine: {
            type: 'string',
            description: 'Engine name: "chess" or "kuhn-poker"',
            enum: ['chess', 'kuhn-poker'],
          },
          config: {
            type: 'object',
            description: 'Optional engine config (e.g. {"seed": 42} for reproducible kuhn-poker)',
          },
        },
      },
    },
    {
      name: 'join_session',
      description:
        'Join a session as a named player. First joiner plays the first role ' +
        '(white in chess), second plays the second role (black). ' +
        'Returns confirmation and role assignment.',
      inputSchema: {
        type: 'object',
        required: ['sessionId', 'playerId'],
        properties: {
          sessionId: { type: 'string', description: 'Session ID from create_session' },
          playerId: {
            type: 'string',
            description: 'Your chosen player name (e.g. "alice", "white", "player1")',
          },
        },
      },
    },
    {
      name: 'get_observation',
      description:
        'Get the current game state as seen by a specific player. ' +
        'For chess: full board in FEN notation + list of legal moves. ' +
        'For kuhn-poker: your private card only (not your opponent\'s). ' +
        'Also returns whose turn it is and the game status.',
      inputSchema: {
        type: 'object',
        required: ['sessionId', 'playerId'],
        properties: {
          sessionId: { type: 'string' },
          playerId: { type: 'string' },
        },
      },
    },
    {
      name: 'submit_action',
      description:
        'Submit a move or action as a player. ' +
        'Chess action format: {"from":"e2","to":"e4"} or with promotion {"from":"e7","to":"e8","promotion":"q"}. ' +
        'Kuhn-poker action format: {"type":"CHECK"}, {"type":"BET"}, {"type":"CALL"}, or {"type":"FOLD"}. ' +
        'Returns a signed receipt with before/after state hashes for independent verification.',
      inputSchema: {
        type: 'object',
        required: ['sessionId', 'playerId', 'action'],
        properties: {
          sessionId: { type: 'string' },
          playerId: { type: 'string' },
          action: {
            type: 'object',
            description:
              'The action to submit. Chess: {from, to, promotion?}. Kuhn-poker: {type}',
          },
        },
      },
    },
    {
      name: 'get_session',
      description:
        'Get session status, enrolled players, and result if the game is over. ' +
        'Use this to check if a game is finished and who won.',
      inputSchema: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: { type: 'string' },
        },
      },
    },
    {
      name: 'get_transcript',
      description:
        'Get the full signed transcript of all moves with cryptographic state hash chain. ' +
        'Each entry includes the action, player, and before/after state hashes. ' +
        'The transcript can be independently replayed to verify the game.',
      inputSchema: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: { type: 'string' },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  try {
    let result: unknown;

    switch (name) {
      case 'list_engines': {
        const root = (await api('GET', '/')) as { engines: unknown };
        result = root.engines;
        break;
      }
      case 'create_session':
        result = await api('POST', '/sessions', {
          engine: a.engine,
          ...(a.config ? { config: a.config } : {}),
        });
        break;

      case 'join_session':
        result = await api('POST', `/sessions/${a.sessionId}/join`, {
          playerId: a.playerId,
        });
        break;

      case 'get_observation':
        result = await api(
          'GET',
          `/sessions/${a.sessionId}/observation?playerId=${encodeURIComponent(a.playerId as string)}`
        );
        break;

      case 'submit_action':
        result = await api('POST', `/sessions/${a.sessionId}/actions`, {
          playerId: a.playerId,
          action: a.action,
        });
        break;

      case 'get_session':
        result = await api('GET', `/sessions/${a.sessionId}`);
        break;

      case 'get_transcript':
        result = await api('GET', `/sessions/${a.sessionId}/transcript`);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
