export function createOpenApiSpec(serverUrl: string) {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Turnbase',
      version: '0.1.0',
      description: `Turnbase is a neutral, verifiable execution layer for structured, turn-based interactions between multiple parties.

## Session Lifecycle

1. **Create** a session — \`POST /sessions\` with \`{"engine":"chess"}\` or \`{"engine":"kuhn-poker"}\`
2. **Join** as participants — \`POST /sessions/{id}/join\` with \`{"playerId":"alice"}\`. The game starts automatically when all seats are filled.
3. **Observe** your state — \`GET /sessions/{id}/observation?playerId=alice\` returns your scoped view and legal actions.
4. **Act** — \`POST /sessions/{id}/actions\` with your playerId and action. The engine validates, applies, and returns an updated observation + signed receipt.
5. **Verify** — \`GET /sessions/{id}/transcript\` returns the append-only log. \`GET /sessions/{id}/receipt/{turn}\` returns the signed receipt for any turn. When the session is terminal, \`GET /sessions/{id}\` includes \`verificationData\` to replay the full game independently.

## Engines

### chess
Standard chess. First player to join plays **white**, second plays **black**.

Action format:
\`\`\`json
{ "from": "e2", "to": "e4" }
{ "from": "e7", "to": "e8", "promotion": "q" }
\`\`\`

### kuhn-poker
Simplified 3-card poker with cards J (jack), Q (queen), K (king). K beats Q beats J.
Each player is dealt 1 card. Player 0 (first to join) acts first.

Action format:
\`\`\`json
{ "type": "CHECK" }
{ "type": "BET" }
{ "type": "CALL" }
{ "type": "FOLD" }
\`\`\`

Game tree: CHECK→CHECK (showdown), CHECK→BET→CALL/FOLD, BET→CALL/FOLD.

## Verifiability

Every action produces a signed receipt containing:
- \`stateHashBefore\` and \`stateHashAfter\` — SHA-256 of canonical state
- \`engineName\` and \`engineVersion\` — for exact replay
- \`configHash\` — SHA-256 of session configuration
- \`signature\` — HMAC-SHA256 of the above

Given a transcript + engine version + initial state, any party can independently replay and verify the outcome.`,
    },
    servers: [{ url: serverUrl }],
    paths: {
      '/': {
        get: {
          summary: 'API overview',
          description: 'Returns server info, available engines, and endpoint listing.',
          operationId: 'getRoot',
          responses: {
            '200': {
              description: 'Server info',
              content: {
                'application/json': {
                  example: {
                    name: 'Turnbase',
                    version: '0.1.0',
                    engines: [{ name: 'chess', version: '1.0.0', minPlayers: 2, maxPlayers: 2 }],
                  },
                },
              },
            },
          },
        },
      },
      '/sessions': {
        post: {
          summary: 'Create a session',
          description: 'Creates a new session with a pinned engine version. Session status is `waiting` until all players join.',
          operationId: 'createSession',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['engine'],
                  properties: {
                    engine: {
                      type: 'string',
                      description: 'Engine name. Currently: `chess`, `kuhn-poker`.',
                      example: 'chess',
                    },
                    config: {
                      type: 'object',
                      description: 'Engine-specific configuration. For `kuhn-poker`, optionally provide `{"seed": 12345}` for reproducible card dealing.',
                      example: {},
                    },
                  },
                },
                examples: {
                  chess: { value: { engine: 'chess' } },
                  kuhnPoker: { value: { engine: 'kuhn-poker' } },
                  kuhnPokerWithSeed: { value: { engine: 'kuhn-poker', config: { seed: 42 } } },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Session created',
              content: {
                'application/json': {
                  example: {
                    sessionId: 'uuid',
                    engine: 'chess',
                    engineVersion: '1.0.0',
                    configHash: 'sha256hex',
                    status: 'waiting',
                    maxPlayers: 2,
                    playersJoined: 0,
                  },
                },
              },
            },
            '400': { description: 'Missing or unknown engine' },
          },
        },
      },
      '/sessions/{id}': {
        get: {
          summary: 'Get session summary',
          description: 'Returns session metadata. When `status` is `terminal`, includes `verificationData` with the initial state for independent replay.',
          operationId: 'getSession',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': {
              description: 'Session summary',
              content: {
                'application/json': {
                  example: {
                    sessionId: 'uuid',
                    engine: 'chess',
                    engineVersion: '1.0.0',
                    configHash: 'sha256hex',
                    status: 'terminal',
                    players: ['alice', 'bob'],
                    maxPlayers: 2,
                    totalTurns: 7,
                    stateHash: 'sha256hex',
                    result: { winner: 'alice', reason: 'checkmate' },
                    verificationData: { initialState: {} },
                    createdAt: 1700000000000,
                  },
                },
              },
            },
            '404': { description: 'Session not found' },
          },
        },
      },
      '/sessions/{id}/join': {
        post: {
          summary: 'Join a session',
          description: 'Join as a participant. Players are assigned roles in join order (chess: first → white, second → black; kuhn-poker: first → player 0, second → player 1). The game starts automatically when the last seat is filled.',
          operationId: 'joinSession',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['playerId'],
                  properties: {
                    playerId: { type: 'string', description: 'Your unique player identifier for this session.', example: 'alice' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Joined successfully',
              content: {
                'application/json': {
                  example: {
                    sessionId: 'uuid',
                    playerId: 'alice',
                    joinOrder: 1,
                    status: 'active',
                    playersJoined: 2,
                    maxPlayers: 2,
                    message: 'All players joined — game started',
                  },
                },
              },
            },
            '404': { description: 'Session not found' },
            '409': { description: 'Session is not waiting, player already joined, or session is full' },
          },
        },
      },
      '/sessions/{id}/observation': {
        get: {
          summary: 'Get player-scoped observation',
          description: 'Returns a view of the current state scoped to the requesting player. For chess: full board (no hidden info) + legal moves. For kuhn-poker: your card only (opponent card hidden) + betting history + legal actions.',
          operationId: 'getObservation',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'playerId', in: 'query', required: true, schema: { type: 'string' }, description: 'Your player ID.' },
          ],
          responses: {
            '200': {
              description: 'Player observation',
              content: {
                'application/json': {
                  examples: {
                    chess: {
                      summary: 'Chess observation',
                      value: {
                        sessionId: 'uuid',
                        playerId: 'alice',
                        turn: 0,
                        stateHash: 'sha256hex',
                        engineName: 'chess',
                        engineVersion: '1.0.0',
                        status: 'active',
                        observation: {
                          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                          turn: 'white',
                          yourColor: 'white',
                          legalMoves: [{ from: 'e2', to: 'e4' }, { from: 'd2', to: 'd4' }],
                          isTerminal: false,
                          result: null,
                          inCheck: false,
                        },
                        legalActions: [{ from: 'e2', to: 'e4' }, { from: 'd2', to: 'd4' }],
                      },
                    },
                    kuhnPoker: {
                      summary: 'Kuhn Poker observation',
                      value: {
                        sessionId: 'uuid',
                        playerId: 'alice',
                        turn: 0,
                        stateHash: 'sha256hex',
                        engineName: 'kuhn-poker',
                        engineVersion: '1.0.0',
                        status: 'active',
                        observation: {
                          yourCard: 'K',
                          history: [],
                          pot: 2,
                          yourBet: 1,
                          opponentBet: 1,
                          isTerminal: false,
                          result: null,
                          legalActions: ['CHECK', 'BET'],
                        },
                        legalActions: [{ type: 'CHECK' }, { type: 'BET' }],
                      },
                    },
                  },
                },
              },
            },
            '403': { description: 'Player not in session' },
            '404': { description: 'Session not found' },
          },
        },
      },
      '/sessions/{id}/actions': {
        post: {
          summary: 'Submit an action',
          description: `Submit your move. The engine validates it, applies it, and returns an updated observation, your new legal actions, and a signed receipt.

**Chess action:** \`{"from": "e2", "to": "e4"}\` — required fields: \`from\`, \`to\`. Optional: \`promotion\` (one of \`"q"\`, \`"r"\`, \`"b"\`, \`"n"\`) when a pawn reaches the back rank.

**Kuhn Poker action:** \`{"type": "CHECK"}\` — required field: \`type\` (one of \`CHECK\`, \`BET\`, \`CALL\`, \`FOLD\`). Only legal actions are accepted; check your observation for the current legal set.`,
          operationId: 'submitAction',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['playerId', 'action'],
                  properties: {
                    playerId: { type: 'string', example: 'alice' },
                    action: {
                      type: 'object',
                      description: 'Engine-specific action. Chess: `{"from":"e2","to":"e4"}`. Kuhn Poker: `{"type":"BET"}`.',
                    },
                  },
                },
                examples: {
                  chessMove: { summary: 'Chess move', value: { playerId: 'alice', action: { from: 'e2', to: 'e4' } } },
                  chessPromotion: { summary: 'Pawn promotion', value: { playerId: 'alice', action: { from: 'e7', to: 'e8', promotion: 'q' } } },
                  kuhnBet: { summary: 'Kuhn Poker BET', value: { playerId: 'alice', action: { type: 'BET' } } },
                  kuhnFold: { summary: 'Kuhn Poker FOLD', value: { playerId: 'bob', action: { type: 'FOLD' } } },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Action accepted',
              content: {
                'application/json': {
                  example: {
                    turn: 1,
                    stateHash: 'sha256hex',
                    status: 'active',
                    result: null,
                    receipt: {
                      turn: 1,
                      sessionId: 'uuid',
                      player: 'alice',
                      action: { from: 'e2', to: 'e4' },
                      stateHashBefore: 'sha256hex',
                      stateHashAfter: 'sha256hex',
                      engineName: 'chess',
                      engineVersion: '1.0.0',
                      configHash: 'sha256hex',
                      timestamp: 1700000000000,
                      signature: 'hmachex',
                    },
                    observation: {},
                    legalActions: [],
                  },
                },
              },
            },
            '403': { description: 'Player not in session' },
            '404': { description: 'Session not found' },
            '409': { description: 'Session is not active' },
            '422': { description: 'Invalid or illegal action' },
          },
        },
      },
      '/sessions/{id}/transcript': {
        get: {
          summary: 'Get append-only transcript',
          description: 'Returns the full action log. Each entry includes the action, player, state hashes before and after, timestamp, and signed receipt. Given this transcript + engine version + initial state, any party can independently replay and verify the outcome.',
          operationId: 'getTranscript',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': {
              description: 'Transcript',
              content: {
                'application/json': {
                  example: {
                    sessionId: 'uuid',
                    engine: 'chess',
                    engineVersion: '1.0.0',
                    configHash: 'sha256hex',
                    status: 'terminal',
                    totalTurns: 7,
                    transcript: [
                      {
                        turn: 1,
                        player: 'alice',
                        action: { from: 'e2', to: 'e4' },
                        stateHashBefore: 'sha256hex',
                        stateHashAfter: 'sha256hex',
                        timestamp: 1700000000000,
                        receipt: { signature: 'hmachex' },
                      },
                    ],
                  },
                },
              },
            },
            '404': { description: 'Session not found' },
          },
        },
      },
      '/sessions/{id}/receipt/{turn}': {
        get: {
          summary: 'Get signed receipt for a turn',
          description: 'Returns the signed execution receipt for a specific turn. The receipt cryptographically commits to the action, state transition, engine version, and configuration.',
          operationId: 'getReceipt',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'turn', in: 'path', required: true, schema: { type: 'integer', minimum: 1 }, description: 'Turn number (1-indexed).' },
          ],
          responses: {
            '200': {
              description: 'Signed receipt',
              content: {
                'application/json': {
                  example: {
                    receipt: {
                      turn: 1,
                      sessionId: 'uuid',
                      player: 'alice',
                      action: { from: 'e2', to: 'e4' },
                      stateHashBefore: 'sha256hex',
                      stateHashAfter: 'sha256hex',
                      engineName: 'chess',
                      engineVersion: '1.0.0',
                      configHash: 'sha256hex',
                      timestamp: 1700000000000,
                      signature: 'hmachex',
                    },
                  },
                },
              },
            },
            '404': { description: 'Session or turn not found' },
          },
        },
      },
    },
  };
}
