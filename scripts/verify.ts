#!/usr/bin/env npx tsx
/**
 * Turnbase replay verifier
 *
 * Given a session ID, fetches the transcript from a Turnbase server,
 * reconstructs the game from scratch using the engine, and verifies
 * that every state hash in the transcript is correct.
 *
 * Usage:
 *   npx tsx scripts/verify.ts <sessionId> [baseUrl]
 *
 * Examples:
 *   npx tsx scripts/verify.ts abc123
 *   npx tsx scripts/verify.ts abc123 https://my-server.fly.dev
 */

import { getEngine } from '../src/engines/registry';
import { hashState } from '../src/signing';

const [sessionId, baseUrl = 'http://localhost:3000'] = process.argv.slice(2);

if (!sessionId) {
  console.error('Usage: npx tsx scripts/verify.ts <sessionId> [baseUrl]');
  process.exit(1);
}

async function main() {
  console.log(`\nTurnbase Replay Verifier`);
  console.log(`Server:  ${baseUrl}`);
  console.log(`Session: ${sessionId}\n`);

  const [sessionRes, transcriptRes] = await Promise.all([
    fetch(`${baseUrl}/sessions/${sessionId}`),
    fetch(`${baseUrl}/sessions/${sessionId}/transcript`),
  ]);

  if (!sessionRes.ok) {
    console.error(`Failed to fetch session: ${sessionRes.status}`);
    process.exit(1);
  }

  const session = await sessionRes.json() as {
    engine: string;
    engineVersion: string;
    configHash: string;
    status: string;
    players: string[];
    config?: unknown;
    result?: Record<string, unknown>;
    verificationData?: { initialState: unknown };
  };

  const { transcript, totalTurns } = await transcriptRes.json() as {
    transcript: Array<{
      turn: number;
      player: string;
      action: unknown;
      stateHashBefore: string;
      stateHashAfter: string;
    }>;
    totalTurns: number;
  };

  const engine = getEngine(session.engine);
  if (!engine) {
    console.error(`Unknown engine: ${session.engine}`);
    process.exit(1);
  }

  console.log(`Engine:     ${session.engine} v${session.engineVersion}`);
  console.log(`Config:     ${session.configHash}`);
  console.log(`Status:     ${session.status}`);
  console.log(`Turns:      ${totalTurns}`);
  console.log(`Players:    ${session.players.join(', ')}\n`);

  if (totalTurns === 0) {
    console.log('No moves to verify.');
    process.exit(0);
  }

  // Reconstruct initial state
  // Chess: fully deterministic — no seed needed
  // Kuhn Poker: seed stored in initialState (revealed after game ends via verificationData)
  let state: unknown;

  if (session.engine === 'chess') {
    state = engine.initialState(session.config ?? {}, session.players);
  } else if (session.verificationData?.initialState) {
    state = session.verificationData.initialState;
  } else {
    // Game still in progress or initial state not yet available — verify chain consistency only
    console.log('Note: initial state not available (game still active or not yet terminal).');
    console.log('Verifying transcript hash chain consistency only...\n');
    verifyChainOnly(transcript);
    return;
  }

  // Verify initial state hash matches transcript anchor
  const computedInitialHash = hashState(engine.serialize(state));
  const expectedInitialHash = transcript[0].stateHashBefore;

  if (computedInitialHash !== expectedInitialHash) {
    console.error(`FAIL  Initial state hash mismatch`);
    console.error(`      Computed: ${computedInitialHash}`);
    console.error(`      Expected: ${expectedInitialHash}`);
    process.exit(1);
  }

  console.log(`PASS  Initial state hash\n      ${computedInitialHash}\n`);

  let currentHash = computedInitialHash;
  let allPass = true;

  for (const entry of transcript) {
    if (entry.stateHashBefore !== currentHash) {
      console.error(`FAIL  Turn ${entry.turn}: stateHashBefore mismatch`);
      console.error(`      Computed: ${currentHash}`);
      console.error(`      Recorded: ${entry.stateHashBefore}`);
      allPass = false;
      break;
    }

    const validation = engine.validateAction(state, entry.action, entry.player);
    if (!validation.valid) {
      console.error(`FAIL  Turn ${entry.turn}: invalid action — ${validation.error}`);
      allPass = false;
      break;
    }

    state = engine.applyAction(state, entry.action, entry.player);
    currentHash = hashState(engine.serialize(state));

    if (currentHash !== entry.stateHashAfter) {
      console.error(`FAIL  Turn ${entry.turn}: stateHashAfter mismatch`);
      console.error(`      Computed: ${currentHash}`);
      console.error(`      Recorded: ${entry.stateHashAfter}`);
      allPass = false;
      break;
    }

    console.log(`PASS  Turn ${entry.turn}  [${entry.player}] ${JSON.stringify(entry.action)}`);
    console.log(`      ${entry.stateHashBefore.slice(0, 16)}... → ${currentHash.slice(0, 16)}...`);
  }

  if (!allPass) {
    console.error('\nVERIFICATION FAILED');
    process.exit(1);
  }

  if (session.status === 'terminal' && session.result) {
    const computedResult = engine.getResult(state);
    const recordedWinner = (session.result as Record<string, unknown>).winner;
    const computedWinner = (computedResult as Record<string, unknown>).winner;

    console.log(`\nResult (recorded):  ${JSON.stringify(session.result)}`);
    console.log(`Result (computed):  ${JSON.stringify(computedResult)}`);

    if (recordedWinner !== computedWinner) {
      console.error('\nFAIL  Result winner mismatch');
      process.exit(1);
    }
  }

  console.log(`\nVERIFIED — ${totalTurns} turn${totalTurns === 1 ? '' : 's'} replayed and confirmed`);
  process.exit(0);
}

function verifyChainOnly(transcript: Array<{ turn: number; stateHashBefore: string; stateHashAfter: string }>) {
  let prev: string | null = null;
  for (const entry of transcript) {
    if (prev !== null && entry.stateHashBefore !== prev) {
      console.error(`FAIL  Turn ${entry.turn}: hash chain broken`);
      process.exit(1);
    }
    prev = entry.stateHashAfter;
    console.log(`PASS  Turn ${entry.turn}  ${entry.stateHashBefore.slice(0, 16)}... → ${entry.stateHashAfter.slice(0, 16)}...`);
  }
  console.log(`\nHash chain verified (${transcript.length} turns). Full replay requires terminal session.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
