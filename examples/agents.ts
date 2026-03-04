/**
 * Turnbase two-agent demo
 *
 * Two Claude instances play a full chess game against each other
 * over the Turnbase API, then the transcript is independently verified.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npm run demo
 *   ANTHROPIC_API_KEY=sk-... TURNBASE_URL=http://localhost:3000 npm run demo
 */

import Anthropic from '@anthropic-ai/sdk';
import { spawnSync } from 'node:child_process';

const BASE = process.env.TURNBASE_URL ?? 'https://turnbase.onrender.com';
const MODEL = 'claude-haiku-4-5-20251001';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is required');
  process.exit(1);
}

const anthropic = new Anthropic();

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function pickMove(
  color: string,
  fen: string,
  legalMoves: Array<{ from: string; to: string; promotion?: string }>
): Promise<{ from: string; to: string; promotion?: string }> {
  const moveList = legalMoves.map((m) => `${m.from}${m.to}${m.promotion ?? ''}`).join(' ');

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16,
    messages: [
      {
        role: 'user',
        content: `Chess. You play ${color}. FEN: ${fen}\nLegal moves: ${moveList}\nReply with one move only (e.g. e2e4):`,
      },
    ],
  });

  const raw = (msg.content[0] as { text: string }).text.trim().toLowerCase().split(/\s/)[0];
  const from = raw.slice(0, 2);
  const to = raw.slice(2, 4);
  const promotion = raw.length > 4 ? raw[4] : undefined;

  const valid = legalMoves.find((m) => m.from === from && m.to === to);
  return valid ? { from, to, ...(promotion ? { promotion } : {}) } : legalMoves[0];
}

async function main() {
  console.log('Turnbase · Two-Agent Demo');
  console.log(`Server : ${BASE}`);
  console.log(`Model  : ${MODEL}\n`);

  // Warm up the server (Render free tier spins down)
  process.stdout.write('Connecting...');
  await api('GET', '/');
  console.log(' ready\n');

  // Create session and join
  const { sessionId } = await api('POST', '/sessions', { engine: 'chess' });
  console.log(`Session: ${sessionId}\n`);

  await api('POST', `/sessions/${sessionId}/join`, { playerId: 'white' });
  await api('POST', `/sessions/${sessionId}/join`, { playerId: 'black' });

  console.log('White (Claude) vs Black (Claude)');
  console.log('─'.repeat(52));

  let currentPlayer: 'white' | 'black' = 'white';
  const MAX_TURNS = 200;

  for (let t = 0; t < MAX_TURNS; t++) {
    const obs = await api('GET', `/sessions/${sessionId}/observation?playerId=${currentPlayer}`);

    if (obs.status === 'terminal' || obs.legalActions.length === 0) break;

    const move = await pickMove(currentPlayer, obs.observation.fen, obs.legalActions);
    const result = await api('POST', `/sessions/${sessionId}/actions`, {
      playerId: currentPlayer,
      action: move,
    });

    const hash = (result.stateHash as string).slice(0, 10);
    const label = currentPlayer.padEnd(5);
    const mv = `${move.from}→${move.to}${move.promotion ? `=${move.promotion}` : ''}`;
    console.log(`  ${String(result.turn).padStart(3)}.  [${label}]  ${mv.padEnd(8)}  ${hash}...`);

    if (result.status === 'terminal') {
      const r = result.result as Record<string, unknown>;
      console.log('─'.repeat(52));
      if (r.winner) {
        console.log(`\n  ${r.winner} wins by ${r.reason}`);
      } else {
        console.log(`\n  Draw — ${r.reason}`);
      }
      break;
    }

    currentPlayer = result.observation.turn as 'white' | 'black';
  }

  // Independent verification
  console.log('\nVerifying transcript...\n');
  const verifier = spawnSync('npx', ['tsx', 'scripts/verify.ts', sessionId, BASE], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  if (verifier.status !== 0) process.exit(1);

  console.log(`\nTranscript : ${BASE}/sessions/${sessionId}/transcript`);
  console.log(`Receipt #1 : ${BASE}/sessions/${sessionId}/receipt/1`);
  console.log(`API docs   : ${BASE}/docs`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
