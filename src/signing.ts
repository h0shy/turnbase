import { createHash } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';

// EIP-712 domain for Turnbase receipts
const DOMAIN = {
  name: 'Turnbase',
  version: '1',
} as const;

// EIP-712 typed data structure for receipts
const RECEIPT_TYPES = {
  Receipt: [
    { name: 'turn', type: 'uint256' },
    { name: 'sessionId', type: 'string' },
    { name: 'player', type: 'string' },
    { name: 'action', type: 'string' },
    { name: 'stateHashBefore', type: 'string' },
    { name: 'stateHashAfter', type: 'string' },
    { name: 'engineName', type: 'string' },
    { name: 'engineVersion', type: 'string' },
    { name: 'configHash', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
  ],
} as const;

function getAccount() {
  const key = process.env.TURNBASE_PRIVATE_KEY;
  if (!key) throw new Error('TURNBASE_PRIVATE_KEY env var is required');
  return privateKeyToAccount(key as Hex);
}

let _signerAddress: string | undefined;

export function getSignerAddress(): string {
  if (!_signerAddress) {
    _signerAddress = getAccount().address;
  }
  return _signerAddress;
}

export async function signPayload(payload: Record<string, unknown>): Promise<string> {
  const account = getAccount();
  const signature = await account.signTypedData({
    domain: DOMAIN,
    types: RECEIPT_TYPES,
    primaryType: 'Receipt',
    message: {
      turn: BigInt(payload.turn as number),
      sessionId: payload.sessionId as string,
      player: payload.player as string,
      action: JSON.stringify(payload.action),
      stateHashBefore: payload.stateHashBefore as string,
      stateHashAfter: payload.stateHashAfter as string,
      engineName: payload.engineName as string,
      engineVersion: payload.engineVersion as string,
      configHash: payload.configHash as string,
      timestamp: BigInt(payload.timestamp as number),
    },
  });
  return signature;
}

export function hashState(serialized: string): string {
  return createHash('sha256').update(serialized).digest('hex');
}

export function hashConfig(config: unknown): string {
  return createHash('sha256').update(JSON.stringify(config ?? {})).digest('hex');
}
