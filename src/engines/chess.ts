import { Chess } from 'chess.js';
import type { Engine, ValidationResult } from './types';

export interface ChessState {
  fen: string;
  players: {
    white: string;
    black: string;
  };
}

export interface ChessAction {
  from: string;
  to: string;
  promotion?: string;
}

export interface ChessObservation {
  fen: string;
  turn: 'white' | 'black';
  yourColor: 'white' | 'black' | null;
  legalMoves: ChessAction[];
  isTerminal: boolean;
  result: Record<string, unknown> | null;
  inCheck: boolean;
}

function colorOf(state: ChessState, player: string): 'white' | 'black' | null {
  if (state.players.white === player) return 'white';
  if (state.players.black === player) return 'black';
  return null;
}

function computeResult(chess: Chess, state: ChessState): Record<string, unknown> {
  if (chess.isCheckmate()) {
    const loserColor = chess.turn() === 'w' ? 'white' : 'black';
    const winnerColor = loserColor === 'white' ? 'black' : 'white';
    return {
      winner: state.players[winnerColor],
      loser: state.players[loserColor],
      reason: 'checkmate',
    };
  }
  if (chess.isStalemate()) {
    return { winner: null, reason: 'stalemate', players: state.players };
  }
  if (chess.isInsufficientMaterial()) {
    return { winner: null, reason: 'insufficient_material', players: state.players };
  }
  if (chess.isThreefoldRepetition()) {
    return { winner: null, reason: 'threefold_repetition', players: state.players };
  }
  if (chess.isDraw()) {
    return { winner: null, reason: 'draw', players: state.players };
  }
  return { winner: null, reason: 'unknown' };
}

export const chessEngine: Engine<ChessState, ChessAction, ChessObservation> = {
  name: 'chess',
  version: '1.0.0',
  minPlayers: 2,
  maxPlayers: 2,

  initialState(_config: unknown, players: string[]): ChessState {
    return {
      fen: new Chess().fen(),
      players: { white: players[0], black: players[1] },
    };
  },

  observation(state: ChessState, player: string): ChessObservation {
    const chess = new Chess(state.fen);
    const currentTurn = chess.turn() === 'w' ? 'white' : 'black';
    const yourColor = colorOf(state, player);
    const terminal = chess.isGameOver();

    const legalMoves: ChessAction[] =
      yourColor === currentTurn && !terminal
        ? chess.moves({ verbose: true }).map((m) => ({
            from: m.from,
            to: m.to,
            ...(m.promotion ? { promotion: m.promotion } : {}),
          }))
        : [];

    return {
      fen: state.fen,
      turn: currentTurn,
      yourColor,
      legalMoves,
      isTerminal: terminal,
      result: terminal ? computeResult(chess, state) : null,
      inCheck: chess.isCheck(),
    };
  },

  validateAction(state: ChessState, action: ChessAction, player: string): ValidationResult {
    const chess = new Chess(state.fen);

    if (chess.isGameOver()) {
      return { valid: false, error: 'Game is already over' };
    }

    const currentTurn = chess.turn() === 'w' ? 'white' : 'black';
    const playerColor = colorOf(state, player);

    if (!playerColor) {
      return { valid: false, error: 'Player not in this session' };
    }
    if (playerColor !== currentTurn) {
      return { valid: false, error: `Not your turn — you are ${playerColor}, it is ${currentTurn}'s turn` };
    }

    try {
      chess.move({ from: action.from, to: action.to, ...(action.promotion ? { promotion: action.promotion } : {}) });
      return { valid: true };
    } catch {
      return { valid: false, error: `Illegal move: ${action.from}→${action.to}` };
    }
  },

  applyAction(state: ChessState, action: ChessAction, _player: string): ChessState {
    const chess = new Chess(state.fen);
    chess.move({ from: action.from, to: action.to, ...(action.promotion ? { promotion: action.promotion } : {}) });
    return { ...state, fen: chess.fen() };
  },

  getLegalActions(state: ChessState, player: string): ChessAction[] {
    const chess = new Chess(state.fen);
    const currentTurn = chess.turn() === 'w' ? 'white' : 'black';
    const playerColor = colorOf(state, player);

    if (playerColor !== currentTurn || chess.isGameOver()) return [];

    return chess.moves({ verbose: true }).map((m) => ({
      from: m.from,
      to: m.to,
      ...(m.promotion ? { promotion: m.promotion } : {}),
    }));
  },

  isTerminal(state: ChessState): boolean {
    return new Chess(state.fen).isGameOver();
  },

  getResult(state: ChessState): Record<string, unknown> {
    return computeResult(new Chess(state.fen), state);
  },

  serialize(state: ChessState): string {
    return state.fen;
  },
};
