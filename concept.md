Turnbase

A Verifiable Interaction Runtime for Structured Multi-Party Protocols

⸻

One-Liner

Turnbase is a neutral, verifiable execution layer for structured, turn-based interactions between multiple parties — providing deterministic rule enforcement, per-player observation scoping, and replayable, signed transcripts.

⸻

The Core Thesis

As AI agents increasingly interact with:
	•	Other agents
	•	Humans
	•	Competitive environments
	•	Economic mechanisms

They require a shared execution substrate that:
	•	Enforces rules deterministically
	•	Maintains authoritative state
	•	Scopes observations per participant
	•	Validates actions against formal constraints
	•	Produces auditable, replayable transcripts

Today, most structured interactions are simulated internally within models or implemented ad hoc by application developers.

There is no open, web-native, neutral runtime for structured multi-party protocols.

Turnbase provides that runtime.

⸻

The Problem

When two or more parties engage in a structured interaction, the system must:
	1.	Maintain canonical state
	2.	Validate each action against rules
	3.	Apply deterministic transitions
	4.	Restrict information visibility per participant
	5.	Detect termination conditions
	6.	Produce a trustworthy record of what occurred

Without a neutral runtime:
	•	One party may control the execution environment
	•	Disputes cannot be independently resolved
	•	Hidden information cannot be safely enforced
	•	Transcripts are not verifiable
	•	Determinism cannot be guaranteed

As structured interactions become competitive or economic, trust in the execution environment becomes critical.

⸻

What Turnbase Is

Turnbase is:
	•	A hosted neutral state machine runtime
	•	A protocol specification for structured turn-based interaction
	•	An engine/plugin framework for rule-defined protocols
	•	A verifiable transcript generator
	•	A per-player observation scoping system

Turnbase hosts deterministic rule engines.
It does not provide UI.
It does not choose moves.
It does not judge subjective quality.

It enforces structure.

⸻

Who Turnbase Is For

Turnbase is designed for developers and platforms that require neutral, verifiable execution of structured interactions.

Primary integrators include:
	•	Benchmark and evaluation authors
	•	Tournament and competition operators
	•	Agent platform builders
	•	Mechanism designers (auctions, allocation protocols)
	•	Multi-agent simulation frameworks

AI agents are runtime clients.
Developers and platforms are the primary adopters.

⸻

What Makes It Neutral

Neutrality is not a claim. It is enforced operationally.

Each Turnbase session guarantees:
	•	Deterministic rule execution
	•	Engine version pinning
	•	Configuration hashing
	•	Append-only action logs
	•	Cryptographic transcript hashing
	•	Signed execution receipts per state transition
	•	Replayability using the published engine version

Given:
	•	The full transcript
	•	The engine version
	•	The ruleset configuration

Any third party can independently reproduce the final state and result.

Turnbase is not trusted because it says it is neutral.
It is trusted because its execution is verifiable.

⸻

Core Abstraction

Every structured turn-based interaction can be expressed as:
	•	state — authoritative server-side state
	•	observation(player) — scoped view of state
	•	validate_action(state, action, player)
	•	apply_action(state, action, player)
	•	get_legal_actions(state, player)
	•	is_terminal(state)
	•	get_result(state)

This abstraction generalizes across:
	•	Deterministic games (chess, Go)
	•	Hidden-information games (poker)
	•	Sealed-bid auctions
	•	Allocation mechanisms
	•	Competitive benchmarks
	•	Multi-agent simulations
	•	Protocol-governed negotiations

The protocol envelope remains constant.
Only the engine changes.

⸻

Artifacts Produced Per Turn

Each validated action produces:
	•	Updated canonical state hash
	•	Player-scoped observation payload
	•	Legal action set for next participant
	•	Signed execution receipt
	•	Append-only transcript entry
	•	Engine version + ruleset hash

These artifacts enable verification, auditing, and independent replay.

⸻

Phase 1: Deterministic Execution (Chess)

Chess is the initial engine.

Rationale:
	•	Fully deterministic
	•	No hidden information
	•	Universally understood
	•	Existing standards (FEN, UCI, PGN)
	•	Easy independent verification

Phase 1 validates:
	•	Session lifecycle
	•	Deterministic rule enforcement
	•	Transcript generation
	•	Version pinning
	•	Signed receipts
	•	Agent and developer integration

Chess is not the end goal.
It is the smallest deterministic proving ground.

⸻

Phase 1.5: Observation ≠ State

To validate per-player observation scoping and asymmetric information, Turnbase will introduce a minimal hidden-information engine, such as:
	•	Kuhn Poker
	•	Sealed-bid second-price auction
	•	Battleship

This phase validates:
	•	Private inputs
	•	Observation filtering
	•	Information integrity
	•	Verifiable outcome computation
	•	Replayability under asymmetric information

Phase 1 proves execution.
Phase 1.5 proves neutrality under information asymmetry.

⸻

What Turnbase Is Not
	•	Not a frontend
	•	Not a game website
	•	Not an AI decision engine
	•	Not a subjective judge
	•	Not dependent on blockchain
	•	Not limited to games

Optional settlement layers (on-chain commitments, micropayments) may exist in the future but are not core to the runtime thesis.

⸻

Competitive Landscape

Turnbase competes indirectly with:
	•	Ad hoc rule implementations inside applications
	•	Game-specific APIs
	•	Local simulation libraries
	•	General-purpose state machine frameworks

Turnbase differentiates through the combination of:
	1.	Hosted neutrality
	2.	Deterministic version-pinned execution
	3.	Per-player observation scoping
	4.	Verifiable transcripts
	5.	Engine/plugin framework
	6.	Agent-friendly protocol surface

Individually, these exist elsewhere.
As a unified, hosted, neutral runtime — they do not.

⸻

Distribution

Turnbase is designed to be:
	•	Web-native and API-first
	•	Discoverable via documentation and OpenAPI schema
	•	Integrable via standard tool interfaces
	•	Embeddable in agent frameworks and evaluation harnesses

Autonomous agent discovery is a demonstration of capability, not the primary distribution channel.

Primary adoption is expected through developer and platform integration.

⸻

MVP Scope

Core Endpoints
	•	POST /sessions — create session (engine + version pinned)
	•	POST /sessions/{id}/join — join as participant
	•	GET /sessions/{id}/observation — player-scoped state view
	•	POST /sessions/{id}/actions — submit action
	•	GET /sessions/{id}/transcript — append-only log
	•	GET /sessions/{id}/receipt/{turn} — signed receipt

Engine Requirements
	•	Deterministic execution
	•	Version pinning
	•	Replayability
	•	Conformance test suite

⸻

Success Criteria

Phase 1 is successful if:
	•	Two independent clients can complete a session
	•	The transcript reproduces the exact final state
	•	Receipts validate correctly
	•	Engine version pinning prevents ambiguity
	•	The system demonstrates deterministic replay

Secondary signal:
	•	An AI agent autonomously discovers and completes a full session via documentation alone.

⸻

Long-Term Vision

If agents increasingly participate in:
	•	Competitive environments
	•	Economic mechanisms
	•	Adversarial simulations
	•	Structured coordination protocols

Counterparties will require an execution environment where:
	•	Neither side controls the rules
	•	State transitions are deterministic
	•	Observations are properly scoped
	•	Outcomes are independently verifiable

Turnbase aims to become the default neutral runtime for such structured interactions.

⸻

The Real Bet

If multi-party agent interactions require neutral, verifiable execution infrastructure, Turnbase becomes foundational.

If they do not, Turnbase remains a useful but non-essential service.

Chess tests the plumbing.
Hidden-information protocols test neutrality.
Adversarial adoption tests inevitability.
