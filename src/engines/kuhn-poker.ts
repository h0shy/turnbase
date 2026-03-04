import type { Engine, ValidationResult } from './types';

type Card = 'J' | 'Q' | 'K';
type KuhnAction = 'CHECK' | 'BET' | 'CALL' | 'FOLD';

const CARD_VALUE: Record<Card, number> = { J: 1, Q: 2, K: 3 };

export interface KuhnPokerState {
  players: [string, string];
  cards: [Card, Card]; // cards[i] belongs to players[i]; never exposed in observation
  history: KuhnAction[];
  seed: number;
}

export interface KuhnPokerObservation {
  yourCard: Card;
  history: KuhnAction[];
  pot: number;
  yourBet: number;
  opponentBet: number;
  isTerminal: boolean;
  result: Record<string, unknown> | null;
  legalActions: KuhnAction[];
}

// --- Pure game logic ---

function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function dealCards(seed: number): [Card, Card] {
  const deck: Card[] = ['J', 'Q', 'K'];
  const rng = seededRng(seed);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return [deck[0], deck[1]];
}

// Actions alternate: player 0 at positions 0,2; player 1 at position 1
function legalActions(history: KuhnAction[]): KuhnAction[] {
  const h = history;
  if (h.length === 0) return ['CHECK', 'BET'];
  if (h.length === 1 && h[0] === 'CHECK') return ['CHECK', 'BET'];
  if (h.length === 1 && h[0] === 'BET') return ['CALL', 'FOLD'];
  if (h.length === 2 && h[0] === 'CHECK' && h[1] === 'BET') return ['CALL', 'FOLD'];
  return []; // terminal
}

function currentPlayerIdx(history: KuhnAction[]): number {
  if (legalActions(history).length === 0) return -1;
  return history.length % 2; // positions 0,1,2 → players 0,1,0
}

function getBets(history: KuhnAction[]): [number, number] {
  const bets: [number, number] = [1, 1]; // ante
  for (let i = 0; i < history.length; i++) {
    const p = i % 2 as 0 | 1;
    if (history[i] === 'BET') bets[p]++;
    else if (history[i] === 'CALL') bets[p] = bets[(1 - p) as 0 | 1];
  }
  return bets;
}

function computeResult(state: KuhnPokerState): Record<string, unknown> | null {
  const { history, cards, players } = state;
  if (legalActions(history).length > 0) return null;

  const bets = getBets(history);
  const last = history[history.length - 1];

  if (last === 'FOLD') {
    // foldPos = history.length - 1; folderIdx = foldPos % 2
    const folderIdx = (history.length - 1) % 2 as 0 | 1;
    const winnerIdx = (1 - folderIdx) as 0 | 1;
    return {
      winner: players[winnerIdx],
      reason: 'fold',
      payout: {
        [players[winnerIdx]]: bets[folderIdx],
        [players[folderIdx]]: -bets[folderIdx],
      },
    };
  }

  // Showdown
  const winnerIdx: 0 | 1 = CARD_VALUE[cards[0]] > CARD_VALUE[cards[1]] ? 0 : 1;
  const loserIdx = (1 - winnerIdx) as 0 | 1;
  return {
    winner: players[winnerIdx],
    reason: 'showdown',
    cards: { [players[0]]: cards[0], [players[1]]: cards[1] },
    payout: {
      [players[winnerIdx]]: bets[loserIdx],
      [players[loserIdx]]: -bets[loserIdx],
    },
  };
}

// --- Engine implementation ---

export const kuhnPokerEngine: Engine<KuhnPokerState, { type: KuhnAction }, KuhnPokerObservation> = {
  name: 'kuhn-poker',
  version: '1.0.0',
  minPlayers: 2,
  maxPlayers: 2,

  initialState(config: unknown, players: string[]): KuhnPokerState {
    const cfg = (config ?? {}) as Record<string, unknown>;
    const seed = typeof cfg.seed === 'number' ? cfg.seed : Math.floor(Math.random() * 2 ** 31);
    return {
      players: [players[0], players[1]] as [string, string],
      cards: dealCards(seed),
      history: [],
      seed,
    };
  },

  observation(state: KuhnPokerState, player: string): KuhnPokerObservation {
    const playerIdx = state.players.indexOf(player) as 0 | 1;
    const bets = getBets(state.history);
    const terminal = legalActions(state.history).length === 0;
    const currentIdx = currentPlayerIdx(state.history);

    return {
      yourCard: state.cards[playerIdx],
      history: state.history,
      pot: bets[0] + bets[1],
      yourBet: bets[playerIdx],
      opponentBet: bets[(1 - playerIdx) as 0 | 1],
      isTerminal: terminal,
      result: terminal ? computeResult(state) : null,
      legalActions: !terminal && currentIdx === playerIdx ? legalActions(state.history) : [],
    };
  },

  validateAction(state: KuhnPokerState, action: { type: KuhnAction }, player: string): ValidationResult {
    if (legalActions(state.history).length === 0) {
      return { valid: false, error: 'Game is already over' };
    }
    const playerIdx = state.players.indexOf(player);
    if (playerIdx === -1) return { valid: false, error: 'Player not in session' };
    if (playerIdx !== currentPlayerIdx(state.history)) {
      return { valid: false, error: 'Not your turn' };
    }
    const legal = legalActions(state.history);
    if (!legal.includes(action.type)) {
      return { valid: false, error: `Illegal action: ${action.type}. Legal: ${legal.join(', ')}` };
    }
    return { valid: true };
  },

  applyAction(state: KuhnPokerState, action: { type: KuhnAction }, _player: string): KuhnPokerState {
    return { ...state, history: [...state.history, action.type] };
  },

  getLegalActions(state: KuhnPokerState, player: string): Array<{ type: KuhnAction }> {
    const playerIdx = state.players.indexOf(player);
    if (playerIdx !== currentPlayerIdx(state.history)) return [];
    return legalActions(state.history).map((type) => ({ type }));
  },

  isTerminal(state: KuhnPokerState): boolean {
    return legalActions(state.history).length === 0;
  },

  getResult(state: KuhnPokerState): Record<string, unknown> {
    return computeResult(state) ?? {};
  },

  serialize(state: KuhnPokerState): string {
    return JSON.stringify({ players: state.players, cards: state.cards, history: state.history, seed: state.seed });
  },
};
