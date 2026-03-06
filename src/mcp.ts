/**
 * Turnbase MCP Server
 *
 * Exposes Turnbase game sessions as MCP tools so AI assistants
 * can create, play, and independently verify structured games.
 *
 * Configure in Claude Desktop
 * (~/.../Application Support/Claude/claude_desktop_config.json):
 *
 *   {
 *     "mcpServers": {
 *       "turnbase": {
 *         "command": "/absolute/path/to/node",
 *         "args": ["/absolute/path/to/turnbase/dist/mcp.js"]
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getEngine } from './engines/registry.js';
import { hashState } from './signing.js';

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

// ─── Verification logic (runs locally — does not trust the server) ─────────

type TranscriptEntry = {
  turn: number;
  player: string;
  action: unknown;
  stateHashBefore: string;
  stateHashAfter: string;
};

type VerifyResult =
  | { verified: true; turns: number; result: unknown }
  | { verified: false; turns: number; failedAtTurn: number | null; reason: string }
  | { verified: 'chain_only'; turns: number; note: string };

async function verifyTranscript(sessionId: string): Promise<VerifyResult> {
  const [sessionRes, transcriptRes] = await Promise.all([
    fetch(`${BASE}/sessions/${sessionId}`),
    fetch(`${BASE}/sessions/${sessionId}/transcript`),
  ]);

  if (!sessionRes.ok) throw new Error(`Session not found: ${sessionRes.status}`);

  const session = (await sessionRes.json()) as {
    engine: string;
    engineVersion: string;
    status: string;
    config?: unknown;
    result?: Record<string, unknown>;
    verificationData?: { initialState: unknown };
  };

  const { transcript, totalTurns } = (await transcriptRes.json()) as {
    transcript: TranscriptEntry[];
    totalTurns: number;
  };

  const engine = getEngine(session.engine);
  if (!engine) throw new Error(`Unknown engine: ${session.engine}`);

  if (totalTurns === 0) {
    return { verified: true, turns: 0, result: null };
  }

  // Determine initial state
  let state: unknown;
  if (session.engine === 'chess') {
    state = engine.initialState(session.config ?? {}, []);
  } else if (session.verificationData?.initialState) {
    state = session.verificationData.initialState;
  } else {
    // Game still active — can only verify hash chain consistency
    let prev: string | null = null;
    for (const entry of transcript) {
      if (prev !== null && entry.stateHashBefore !== prev) {
        return {
          verified: false,
          turns: totalTurns,
          failedAtTurn: entry.turn,
          reason: `Hash chain broken at turn ${entry.turn}`,
        };
      }
      prev = entry.stateHashAfter;
    }
    return {
      verified: 'chain_only',
      turns: totalTurns,
      note: 'Game still active — hash chain is consistent but full replay requires a terminal session.',
    };
  }

  // Verify initial state hash
  const computedInitialHash = hashState(engine.serialize(state));
  if (computedInitialHash !== transcript[0].stateHashBefore) {
    return {
      verified: false,
      turns: totalTurns,
      failedAtTurn: 0,
      reason: `Initial state hash mismatch. Computed: ${computedInitialHash}, expected: ${transcript[0].stateHashBefore}`,
    };
  }

  // Replay every turn
  let currentHash = computedInitialHash;
  for (const entry of transcript) {
    if (entry.stateHashBefore !== currentHash) {
      return {
        verified: false,
        turns: totalTurns,
        failedAtTurn: entry.turn,
        reason: `stateHashBefore mismatch at turn ${entry.turn}`,
      };
    }

    const validation = engine.validateAction(state, entry.action, entry.player);
    if (!validation.valid) {
      return {
        verified: false,
        turns: totalTurns,
        failedAtTurn: entry.turn,
        reason: `Invalid action at turn ${entry.turn}: ${validation.error}`,
      };
    }

    state = engine.applyAction(state, entry.action, entry.player);
    currentHash = hashState(engine.serialize(state));

    if (currentHash !== entry.stateHashAfter) {
      return {
        verified: false,
        turns: totalTurns,
        failedAtTurn: entry.turn,
        reason: `stateHashAfter mismatch at turn ${entry.turn}`,
      };
    }
  }

  // Verify result if terminal
  if (session.status === 'terminal' && session.result) {
    const computedResult = engine.getResult(state) as Record<string, unknown>;
    if (computedResult?.winner !== session.result.winner) {
      return {
        verified: false,
        turns: totalTurns,
        failedAtTurn: null,
        reason: `Result mismatch — server says winner="${session.result.winner}", replay gives "${computedResult?.winner}"`,
      };
    }
  }

  return { verified: true, turns: totalTurns, result: session.result ?? null };
}

// ─── MCP server ────────────────────────────────────────────────────────────

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
        'Create a new game session. Returns a sessionId that players use to join. ' +
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
        '(white in chess), second plays the second role (black).',
      inputSchema: {
        type: 'object',
        required: ['sessionId', 'playerId'],
        properties: {
          sessionId: { type: 'string' },
          playerId: { type: 'string', description: 'Your chosen player name (e.g. "alice", "white")' },
        },
      },
    },
    {
      name: 'get_observation',
      description:
        'Get the current game state scoped to a specific player. ' +
        'For chess: board in FEN notation + list of legal moves. ' +
        "For kuhn-poker: your private card only (not your opponent's). " +
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
        'Chess: {"from":"e2","to":"e4"} or with promotion {"from":"e7","to":"e8","promotion":"q"}. ' +
        'Kuhn-poker: {"type":"CHECK"}, {"type":"BET"}, {"type":"CALL"}, or {"type":"FOLD"}. ' +
        'Returns a signed receipt with before/after state hashes.',
      inputSchema: {
        type: 'object',
        required: ['sessionId', 'playerId', 'action'],
        properties: {
          sessionId: { type: 'string' },
          playerId: { type: 'string' },
          action: { type: 'object' },
        },
      },
    },
    {
      name: 'get_session',
      description: 'Get session status, enrolled players, and result if the game is over.',
      inputSchema: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: { type: 'string' },
        },
      },
    },
    {
      name: 'get_receipt',
      description:
        'Get the signed execution receipt for a specific turn. ' +
        'Contains the action, player, before/after state hashes, engine version, config hash, timestamp, and HMAC signature.',
      inputSchema: {
        type: 'object',
        required: ['sessionId', 'turn'],
        properties: {
          sessionId: { type: 'string' },
          turn: { type: 'number', description: 'Turn number (1-indexed)' },
        },
      },
    },
    {
      name: 'get_transcript',
      description:
        'Get the full signed transcript of all moves with cryptographic state hash chain. ' +
        'Each entry includes the action, player, and before/after state hashes.',
      inputSchema: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: { type: 'string' },
        },
      },
    },
    {
      name: 'verify_transcript',
      description:
        'Independently verify a completed game by replaying it from scratch using the engine rules. ' +
        'Does NOT trust the server — recomputes every state hash locally and checks them against the transcript. ' +
        'Returns verified:true if every turn is valid, or verified:false with the exact turn and reason for failure. ' +
        'This is the tool that proves a Turnbase game was executed fairly.',
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
        result = await api('POST', `/sessions/${a.sessionId}/join`, { playerId: a.playerId });
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

      case 'get_receipt':
        result = await api('GET', `/sessions/${a.sessionId}/receipt/${a.turn}`);
        break;

      case 'get_transcript':
        result = await api('GET', `/sessions/${a.sessionId}/transcript`);
        break;

      case 'verify_transcript':
        result = await verifyTranscript(a.sessionId as string);
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
