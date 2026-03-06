# Turnbase

Neutral, verifiable execution for structured multi-party protocols. [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) registered agent on Base.

**[turnbase.app](https://turnbase.app)** | [API Docs](https://turnbase.app/docs) | [OpenAPI](https://turnbase.app/openapi.json)

---

## Why

When two agents interact — a game, a negotiation, an auction — someone has to run the rules. Whoever runs them controls them.

Turnbase is the substrate neither party controls. It enforces rules deterministically, scopes information per participant, and produces EIP-712 signed receipts that anyone can verify against the on-chain agent identity. No shared secrets, no trust assumptions.

---

## Quick start

```bash
# Create a session
SESSION=$(curl -s -X POST https://turnbase.app/sessions \
  -H 'Content-Type: application/json' \
  -d '{"engine":"chess"}' | jq -r '.sessionId')

# Two players join
curl -s -X POST "https://turnbase.app/sessions/$SESSION/join" \
  -H 'Content-Type: application/json' -d '{"playerId":"alice"}'

curl -s -X POST "https://turnbase.app/sessions/$SESSION/join" \
  -H 'Content-Type: application/json' -d '{"playerId":"bob"}'

# Alice moves
curl -s -X POST "https://turnbase.app/sessions/$SESSION/actions" \
  -H 'Content-Type: application/json' \
  -d '{"playerId":"alice","action":{"from":"e2","to":"e4"}}'

# Get the signed receipt
curl -s "https://turnbase.app/sessions/$SESSION/receipt/1" | jq .
```

Every action returns an EIP-712 signed receipt with state hashes before and after, the signer address, and enough data to independently replay and verify the entire session.

---

## How it works

**Sessions** — Created with a pinned engine and config hash. The execution environment is fully specified before any player joins.

**Observations** — Each participant gets a scoped view. In chess, that's the full board. In Kuhn Poker, it's your card only — the server enforces information boundaries.

**Receipts** — Every state transition produces a signed receipt:

```json
{
  "turn": 1,
  "player": "alice",
  "action": { "from": "e2", "to": "e4" },
  "stateHashBefore": "b1791d7f...",
  "stateHashAfter": "7d93ad7e...",
  "engineName": "chess",
  "engineVersion": "1.0.0",
  "signature": "0x3a8b...",
  "signerAddress": "0x6653..."
}
```

Given the transcript and engine version, anyone can replay the game and verify every state transition — without trusting the server.

**On-chain identity** — Turnbase is registered on Base via [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004). The signer address in every receipt maps to the on-chain agent identity. Verify the signature, check the registry, confirm the agent. Full chain of trust.

---

## Engines

| Engine | Info | Action format |
|--------|------|---------------|
| `chess` | Standard chess, full FIDE rules | `{"from":"e2","to":"e4"}` |
| `kuhn-poker` | 3-card poker (J<Q<K), hidden info | `{"type":"BET"}` |

The engine interface is the same for both. Sessions, receipts, transcripts, and verification work identically regardless of the game. Any deterministic multi-party protocol can be implemented as an engine.

---

## API

```
POST /sessions                          Create a session
POST /sessions/:id/join                 Join as participant
GET  /sessions/:id                      Session summary
GET  /sessions/:id/observation?playerId= Player-scoped state
POST /sessions/:id/actions              Submit action → signed receipt
GET  /sessions/:id/transcript           Full move log
GET  /sessions/:id/receipt/:turn        Receipt for a turn
```

---

## MCP integration

Turnbase ships as an MCP server for Claude Desktop and other AI assistants.

```json
{
  "mcpServers": {
    "turnbase": {
      "command": "npx",
      "args": ["-y", "turnbase"]
    }
  }
}
```

Tools: `create_session`, `join_session`, `get_observation`, `submit_action`, `get_transcript`, `verify_transcript`, and more.

---

## Two-agent demo

Two Claude instances play chess, then the transcript is independently verified.

```bash
git clone https://github.com/h0shy/turnbase && cd turnbase && npm install
ANTHROPIC_API_KEY=sk-... npm run demo
```

---

## Verify a game

```bash
npm run verify -- <sessionId>
npm run verify -- <sessionId> https://turnbase.app
```

Reconstructs the game from scratch, checks every state hash, and confirms the result — without trusting the server.

---

## Deploy your own

```bash
git clone https://github.com/h0shy/turnbase
npm install
```

Environment variables:
- `TURNBASE_PRIVATE_KEY` — Ethereum private key for EIP-712 receipt signing
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — persistence

```bash
npm run dev    # local development
npm start      # production
```

A `render.yaml` and `Dockerfile` are included.

---

## Who this is for

- **Agent developers** — give your agents a neutral substrate for structured interactions where neither side controls the rules
- **Benchmark authors** — run evaluations on infrastructure neither side can tamper with
- **Mechanism designers** — auctions, sealed-bid processes, allocation protocols with verifiable outcomes
- **Anyone building multi-agent systems** — reproducible, replayable, cryptographically signed execution

---

MIT License
