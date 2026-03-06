export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface Engine<S = unknown, A = unknown, O = unknown> {
  readonly name: string;
  readonly version: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;

  initialState(config: unknown, players: string[]): S;
  observation(state: S, player: string): O;
  validateAction(state: S, action: A, player: string): ValidationResult;
  applyAction(state: S, action: A, player: string): S;
  getLegalActions(state: S, player: string): A[];
  isTerminal(state: S): boolean;
  getResult(state: S): Record<string, unknown>;
  serialize(state: S): string;
}

export interface Receipt {
  turn: number;
  sessionId: string;
  player: string;
  action: unknown;
  stateHashBefore: string;
  stateHashAfter: string;
  engineName: string;
  engineVersion: string;
  configHash: string;
  timestamp: number;
  signature: string;
  signerAddress: string;
}

export interface TranscriptEntry {
  turn: number;
  player: string;
  action: unknown;
  stateHashBefore: string;
  stateHashAfter: string;
  timestamp: number;
  receipt: Receipt;
}

export interface Session {
  id: string;
  engine: string;
  engineVersion: string;
  config: unknown;
  configHash: string;
  players: string[];
  maxPlayers: number;
  state: unknown;
  initialState: unknown; // stored at game start for replay verification
  stateHash: string;
  transcript: TranscriptEntry[];
  status: 'waiting' | 'active' | 'terminal';
  result: Record<string, unknown> | null;
  createdAt: number;
}
