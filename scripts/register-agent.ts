/**
 * One-time script to register Turnbase as an ERC-8004 agent on Base.
 *
 * Prerequisites:
 *   - TURNBASE_PRIVATE_KEY in .env (same key used for receipt signing)
 *   - The wallet needs a small amount of ETH on Base for gas
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/register-agent.ts
 */

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';

const IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as const;

const abi = parseAbi([
  'function register(string agentURI) external returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)',
]);

const AGENT_URI = 'https://turnbase.app/.well-known/agent-registration.json';

async function main() {
  const key = process.env.TURNBASE_PRIVATE_KEY;
  if (!key) {
    console.error('TURNBASE_PRIVATE_KEY not set');
    process.exit(1);
  }

  const account = privateKeyToAccount(key as Hex);
  console.log('Wallet:', account.address);

  const publicClient = createPublicClient({ chain: base, transport: http() });
  const walletClient = createWalletClient({ account, chain: base, transport: http() });

  // Check if already registered
  const balance = await publicClient.readContract({
    address: IDENTITY_REGISTRY,
    abi,
    functionName: 'balanceOf',
    args: [account.address],
  });

  if (balance > 0n) {
    console.log('Already registered — this wallet owns', balance.toString(), 'agent identity NFT(s)');
    return;
  }

  console.log('Registering Turnbase agent on Base...');
  const hash = await walletClient.writeContract({
    address: IDENTITY_REGISTRY,
    abi,
    functionName: 'register',
    args: [AGENT_URI],
  });

  console.log('Tx submitted:', hash);
  console.log('Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Confirmed in block', receipt.blockNumber);
  console.log('Agent registered! Check https://basescan.org/tx/' + hash);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
