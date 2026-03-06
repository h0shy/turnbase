import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { getEngine, listEngines } from '../engines/registry';
import { getSession, setSession } from '../store';
import { signPayload, hashState, hashConfig } from '../signing';
import type { Session, TranscriptEntry, Receipt } from '../engines/types';

const sessions = new Hono();

// POST /sessions — create a new session
sessions.post('/', async (c) => {
  let body: { engine?: string; config?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.engine) {
    return c.json({ error: 'engine is required', available: listEngines().map((e) => e.name) }, 400);
  }

  const engine = getEngine(body.engine);
  if (!engine) {
    return c.json({ error: `Unknown engine: ${body.engine}`, available: listEngines().map((e) => e.name) }, 400);
  }

  const config = body.config ?? {};
  const configHash = hashConfig(config);

  const session: Session = {
    id: uuidv4(),
    engine: body.engine,
    engineVersion: engine.version,
    config,
    configHash,
    players: [],
    maxPlayers: engine.maxPlayers,
    state: null,
    initialState: null,
    stateHash: '',
    transcript: [],
    status: 'waiting',
    result: null,
    createdAt: Date.now(),
  };

  await setSession(session);

  return c.json({
    sessionId: session.id,
    engine: session.engine,
    engineVersion: session.engineVersion,
    configHash: session.configHash,
    status: session.status,
    maxPlayers: session.maxPlayers,
    playersJoined: 0,
  }, 201);
});

// GET /sessions/:id — session summary
sessions.get('/:id', async (c) => {
  const session = await getSession(c.req.param('id'));
  if (!session) return c.json({ error: 'Session not found' }, 404);

  return c.json({
    sessionId: session.id,
    engine: session.engine,
    engineVersion: session.engineVersion,
    configHash: session.configHash,
    status: session.status,
    players: session.players,
    maxPlayers: session.maxPlayers,
    totalTurns: session.transcript.length,
    stateHash: session.stateHash || null,
    result: session.result,
    createdAt: session.createdAt,
    // Expose initial state for independent replay once the game is over
    verificationData: session.status === 'terminal' ? { initialState: session.initialState } : undefined,
  });
});

// POST /sessions/:id/join — join as a participant
sessions.post('/:id/join', async (c) => {
  const session = await getSession(c.req.param('id'));
  if (!session) return c.json({ error: 'Session not found' }, 404);
  if (session.status !== 'waiting') return c.json({ error: `Session is ${session.status}` }, 409);

  let body: { playerId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.playerId) return c.json({ error: 'playerId is required' }, 400);
  if (session.players.includes(body.playerId)) return c.json({ error: 'Player already in session' }, 409);
  if (session.players.length >= session.maxPlayers) return c.json({ error: 'Session is full' }, 409);

  const engine = getEngine(session.engine)!;
  const updatedPlayers = [...session.players, body.playerId];
  const joinIndex = updatedPlayers.length - 1;

  let updated: Session = { ...session, players: updatedPlayers };

  if (updatedPlayers.length === session.maxPlayers) {
    const initialState = engine.initialState(session.config, updatedPlayers);
    updated = {
      ...updated,
      state: initialState,
      initialState,
      stateHash: hashState(engine.serialize(initialState)),
      status: 'active',
    };
  }

  await setSession(updated);

  return c.json({
    sessionId: session.id,
    playerId: body.playerId,
    joinOrder: joinIndex + 1,
    status: updated.status,
    playersJoined: updatedPlayers.length,
    maxPlayers: session.maxPlayers,
    message:
      updated.status === 'active'
        ? 'All players joined — game started'
        : `Waiting for ${session.maxPlayers - updatedPlayers.length} more player(s)`,
  });
});

// GET /sessions/:id/observation?playerId= — player-scoped state view
sessions.get('/:id/observation', async (c) => {
  const session = await getSession(c.req.param('id'));
  if (!session) return c.json({ error: 'Session not found' }, 404);

  const playerId = c.req.query('playerId');
  if (!playerId) return c.json({ error: 'playerId query param is required' }, 400);
  if (!session.players.includes(playerId)) return c.json({ error: 'Player not in session' }, 403);

  if (session.status === 'waiting') {
    return c.json({
      sessionId: session.id,
      status: 'waiting',
      playersJoined: session.players.length,
      maxPlayers: session.maxPlayers,
    });
  }

  const engine = getEngine(session.engine)!;
  const observation = engine.observation(session.state, playerId);
  const legalActions = session.status === 'active' ? engine.getLegalActions(session.state, playerId) : [];

  return c.json({
    sessionId: session.id,
    playerId,
    turn: session.transcript.length,
    stateHash: session.stateHash,
    engineName: session.engine,
    engineVersion: session.engineVersion,
    status: session.status,
    observation,
    legalActions,
  });
});

// POST /sessions/:id/actions — submit an action
sessions.post('/:id/actions', async (c) => {
  const session = await getSession(c.req.param('id'));
  if (!session) return c.json({ error: 'Session not found' }, 404);
  if (session.status !== 'active') return c.json({ error: `Session is ${session.status}` }, 409);

  let body: { playerId?: string; action?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.playerId) return c.json({ error: 'playerId is required' }, 400);
  if (!body.action) return c.json({ error: 'action is required' }, 400);
  if (!session.players.includes(body.playerId)) return c.json({ error: 'Player not in session' }, 403);

  const engine = getEngine(session.engine)!;
  const validation = engine.validateAction(session.state, body.action, body.playerId);
  if (!validation.valid) return c.json({ error: validation.error ?? 'Invalid action' }, 422);

  const stateHashBefore = session.stateHash;
  const newState = engine.applyAction(session.state, body.action, body.playerId);
  const stateHashAfter = hashState(engine.serialize(newState));
  const turn = session.transcript.length + 1;
  const timestamp = Date.now();

  const receiptPayload = {
    turn,
    sessionId: session.id,
    player: body.playerId,
    action: body.action,
    stateHashBefore,
    stateHashAfter,
    engineName: session.engine,
    engineVersion: session.engineVersion,
    configHash: session.configHash,
    timestamp,
  };

  const receipt: Receipt = { ...receiptPayload, signature: signPayload(receiptPayload) };

  const entry: TranscriptEntry = {
    turn,
    player: body.playerId,
    action: body.action,
    stateHashBefore,
    stateHashAfter,
    timestamp,
    receipt,
  };

  const terminal = engine.isTerminal(newState);
  const result = terminal ? engine.getResult(newState) : null;

  await setSession({
    ...session,
    state: newState,
    stateHash: stateHashAfter,
    transcript: [...session.transcript, entry],
    status: terminal ? 'terminal' : 'active',
    result,
  });

  const observation = engine.observation(newState, body.playerId);
  const legalActions = terminal ? [] : engine.getLegalActions(newState, body.playerId);

  return c.json({
    turn,
    stateHash: stateHashAfter,
    receipt,
    observation,
    legalActions,
    status: terminal ? 'terminal' : 'active',
    result,
  });
});

// GET /sessions/:id/transcript — append-only action log
sessions.get('/:id/transcript', async (c) => {
  const session = await getSession(c.req.param('id'));
  if (!session) return c.json({ error: 'Session not found' }, 404);

  return c.json({
    sessionId: session.id,
    engine: session.engine,
    engineVersion: session.engineVersion,
    configHash: session.configHash,
    status: session.status,
    totalTurns: session.transcript.length,
    transcript: session.transcript,
  });
});

// GET /sessions/:id/receipt/:turn — signed receipt for a specific turn
sessions.get('/:id/receipt/:turn', async (c) => {
  const session = await getSession(c.req.param('id'));
  if (!session) return c.json({ error: 'Session not found' }, 404);

  const turn = parseInt(c.req.param('turn'), 10);
  if (isNaN(turn) || turn < 1) return c.json({ error: 'turn must be a positive integer' }, 400);

  const entry = session.transcript.find((e) => e.turn === turn);
  if (!entry) return c.json({ error: `No receipt for turn ${turn}` }, 404);

  return c.json({ receipt: entry.receipt });
});

export default sessions;
