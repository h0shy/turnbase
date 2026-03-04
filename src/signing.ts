import { createHmac, randomBytes, createHash } from 'node:crypto';

// Random secret per process — resets on restart (fine for MVP)
const SECRET = randomBytes(32).toString('hex');

export function signPayload(payload: Record<string, unknown>): string {
  const sorted = JSON.stringify(payload, Object.keys(payload).sort());
  return createHmac('sha256', SECRET).update(sorted).digest('hex');
}

export function hashState(serialized: string): string {
  return createHash('sha256').update(serialized).digest('hex');
}

export function hashConfig(config: unknown): string {
  return createHash('sha256').update(JSON.stringify(config ?? {})).digest('hex');
}
