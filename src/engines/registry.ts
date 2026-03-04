import { chessEngine } from './chess';
import { kuhnPokerEngine } from './kuhn-poker';
import type { Engine } from './types';

const registry: Record<string, Engine> = {
  chess: chessEngine as Engine,
  'kuhn-poker': kuhnPokerEngine as Engine,
};

export function getEngine(name: string): Engine | undefined {
  return registry[name];
}

export function listEngines(): Array<{ name: string; version: string; minPlayers: number; maxPlayers: number }> {
  return Object.values(registry).map((e) => ({
    name: e.name,
    version: e.version,
    minPlayers: e.minPlayers,
    maxPlayers: e.maxPlayers,
  }));
}
