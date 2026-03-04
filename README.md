# Turnbase

A neutral, verifiable execution layer for structured multi-party protocols.

---

## The problem

When two parties interact in any structured way — a game, an auction, a negotiation — someone has to run the rules. Whoever runs them controls them.

If you're building agents that compete, benchmark systems that must be tamper-evident, or any protocol where the outcome matters, you need a substrate neither party controls. One that enforces rules deterministically, scopes information correctly per participant, and produces a cryptographic record of every state transition that any third party can independently verify.

That's Turnbase.

---

## Live server

**`https://turnbase.onrender.com`**

- API docs: [/docs](https://turnbase.onrender.com/docs)
- OpenAPI spec: [/openapi.json](https://turnbase.onrender.com/openapi.json)

> Free tier — first request may take ~30s to wake up.

---

## Quick start

```bash
# Create a session
SESSION=$(curl -s -X POST https://turnbase.onrender.com/sessions \
  -H 'Content-Type: application/json' \
  -d '{"engine":"chess"}' | jq -r '.sessionId')

# Two players join
curl -s -X POST "https://turnbase.onrender.com/sessions/$SESSION/join" \
  -H 'Content-Type: application/json' -d '{"playerId":"alice"}'

curl -s -X POST "https://turnbase.onrender.com/sessions/$SESSION/join" \
  -H 'Content-Type: application/json' -d '{"playerId":"bob"}'

# Alice (white) moves
curl -s -X POST "https://turnbase.onrender.com/sessions/$SESSION/actions" \
  -H 'Content-Type: application/json' \
  -d '{"playerId":"alice","action":{"from":"e2","to":"e4"}}'

# Get the signed receipt
curl -s "https://turnbase.onrender.com/sessions/$SESSION/receipt/1" | jq .
```

---

## Two-agent demo

Two Claude instances play a full chess game against each other. At the end, the transcript is independently replayed and verified.

**Prerequisites:** Node 18+, an [Anthropic API key](https://console.anthropic.com/)

```bash
git clone https://github.com/h0shy/turnbase
cd turnbase
npm install

ANTHROPIC_API_KEY=sk-... npm run demo
```

**Example output:**

```
Turnbase · Two-Agent Demo
Server : https://turnbase.onrender.com
Model  : claude-haiku-4-5-20251001

Session: d74df113-...

White (Claude) vs Black (Claude)
────────────────────────────────────────────────────
    1.  [white]  e2→e4    b1791d7fc9...
    2.  [black]  e7→e5    abf9f14281...
    3.  [white]  d1→h5    e12e00588c...
    4.  [black]  b8→c6    64e1a95c34...
    5.  [white]  f1→c4    c60ede4c4c...
    6.  [black]  g8→f6    b028a28d4a...
    7.  [white]  h5→f7    0db02b8a7c...
────────────────────────────────────────────────────

  white wins by checkmate

Verifying transcript...

PASS  Initial state hash
      b1791d7fc9ae3d38...

PASS  Turn 1  [white] {"from":"e2","to":"e4"}
PASS  Turn 2  [black] {"from":"e7","to":"e5"}
...

VERIFIED — 7 turns replayed and confirmed
```

To run against a local server:

```bash
npm run dev  # terminal 1
ANTHROPIC_API_KEY=sk-... TURNBASE_URL=http://localhost:3000 npm run demo  # terminal 2
```

---

## Engines

### `chess`

Standard chess. First player to join plays white, second plays black.

```json
{ "engine": "chess" }
```

Action format:
```json
{ "from": "e2", "to": "e4" }
{ "from": "e7", "to": "e8", "promotion": "q" }
```

### `kuhn-poker`

3-card simplified poker (J < Q < K). Each player is dealt one card and can only see their own. Proves that observation ≠ state — the server enforces information boundaries between participants.

```json
{ "engine": "kuhn-poker" }
{ "engine": "kuhn-poker", "config": { "seed": 42 } }
```

Action format:
```json
{ "type": "CHECK" }
{ "type": "BET" }
{ "type": "CALL" }
{ "type": "FOLD" }
```

---

## Core concepts

### Sessions

Every interaction is a session. Sessions are created with a pinned engine version and a config hash, so the execution environment is fully specified before any player joins.

```
POST /sessions          → create
POST /sessions/:id/join → join as participant
GET  /sessions/:id      → summary + result
```

### Observations

Each participant receives a scoped view of state — only what they're allowed to see. For chess this is the full board. For kuhn-poker it's your card only, not your opponent's.

```
GET /sessions/:id/observation?playerId=alice
```

### Receipts and transcripts

Every action produces a signed receipt:

```json
{
  "turn": 1,
  "player": "alice",
  "action": { "from": "e2", "to": "e4" },
  "stateHashBefore": "b1791d7f...",
  "stateHashAfter":  "7d93ad7e...",
  "engineName": "chess",
  "engineVersion": "1.0.0",
  "configHash": "44136fa3...",
  "timestamp": 1700000000000,
  "signature": "f569659c..."
}
```

Given the full transcript and engine version, any third party can replay the game and verify every state transition independently.

```
GET /sessions/:id/transcript
GET /sessions/:id/receipt/:turn
```

---

## Verify a game

```bash
npm run verify -- <sessionId>
npm run verify -- <sessionId> https://turnbase.onrender.com
```

The verifier reconstructs the game from scratch using the engine, checks every state hash in the transcript, and confirms the final result — without trusting the server.

---

## Deploy your own

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

Or manually:

```bash
git clone https://github.com/h0shy/turnbase
# Connect to Render / Railway / Fly.io
# Build: npm install
# Start: npx tsx src/index.ts
```

A `render.yaml` and `Dockerfile` are included.

---

## What this is for

Turnbase is designed for developers and platforms that need neutral, verifiable execution of structured interactions:

- **Benchmark and evaluation authors** — run agent evaluations on infrastructure neither side controls
- **Tournament operators** — produce results that are independently disputable
- **Agent platform builders** — give agents a shared substrate for adversarial or competitive tasks
- **Mechanism designers** — auctions, allocation protocols, sealed-bid processes with verifiable outcomes
- **Multi-agent simulation** — reproducible, replayable runs with cryptographic integrity
