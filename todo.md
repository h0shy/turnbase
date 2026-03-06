# Turnbase TODO

## Roadmap

### Phase 1: Chess (deterministic, no hidden info) — DONE
- [x] Chess engine, API endpoints, receipts, HMAC-SHA256 signing

### Phase 1.5: Hidden-info engine — DONE
- [x] Kuhn Poker engine (proves observation scoping hides private state)
- [x] Registered in engine registry

### Phase 2: ERC-8004 on-chain identity + EIP-712 signing
- [x] Replace HMAC-SHA256 in signing.ts with EIP-712 structured data signing
- [x] Receipts signed with turnbase's Ethereum key, verifiable by anyone
- [x] Add signerAddress to Receipt type
- [x] .well-known/agent-registration.json endpoint
- [x] Registration script (scripts/register-agent.ts)
- [ ] Register turnbase as an ERC-8004 agent on Base (run script with funded wallet)
- [ ] Add TURNBASE_PRIVATE_KEY to Render environment
- [ ] Optional: post game results to ERC-8004 Reputation Registry

### Phase 3 (deferred): ML-DSA-65
- [ ] Post-quantum signatures — revisit when Ethereum ecosystem moves post-quantum
- [ ] Could dual-sign receipts (EIP-712 + ML-DSA-65) if needed earlier

## Before broadcasting

### Must have
- [x] turnbase.app working (DNS — Porkbun nameservers → Cloudflare, then propagate)
- [x] Persistence — Upstash Redis (sessions survive restarts)

### Should have
- [ ] Update README with npm install + MCP config instructions
- [ ] Add homepage field to package.json pointing to turnbase.app

### Nice to have
- [ ] Kuhn Poker two-agent demo (like examples/agents.ts but for hidden-info game)
- [ ] npm client package — typed fetch wrapper to reduce integration friction

## Broadcasting (do after polish)
- [ ] Smithery.ai — submit github.com/h0shy/turnbase (smithery.yaml already in repo)
- [ ] mcp.so — submit GitHub URL
- [ ] Glama.ai — submit GitHub URL
- [ ] awesome-mcp-servers — PR to github.com/punkpeye/awesome-mcp-servers
- [ ] Hacker News — "Show HN: Turnbase — neutral verifiable execution layer for multi-agent games"
- [ ] Reddit — r/ClaudeAI and r/LocalLLaMA
- [ ] Twitter/X — demo post with chess receipt screenshot
- [ ] Product Hunt — once turnbase.app is live and polished
- [ ] Anthropic Discord — #mcp-servers channel
