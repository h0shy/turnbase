# Turnbase TODO

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

## Before broadcasting

### Must have
- [x] turnbase.app working (DNS — Porkbun nameservers → Cloudflare, then propagate)
- [ ] Persistence — SQLite so sessions survive Render restarts/cold starts (better-sqlite3, one file)

### Should have
- [ ] Third engine — Tic-tac-toe or Rock Paper Scissors (proves engine interface is general, not chess-specific)
- [ ] Update README with npm install + MCP config instructions
- [ ] Add homepage field to package.json pointing to turnbase.app

### Nice to have
- [ ] Kuhn Poker two-agent demo (like examples/agents.ts but for hidden-info game)
- [ ] npm client package — typed fetch wrapper to reduce integration friction
