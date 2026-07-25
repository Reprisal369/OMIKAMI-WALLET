import { z } from 'zod';
import type { Chain } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import type { ChainMeta } from '@omikami/types';

export const chainMetaSchema = z.object({
  chainId: z.number().int().positive(),
  name: z.string().min(1),
  testnet: z.boolean(),
  enabled: z.boolean(),
  transactionsEnabled: z.boolean(),
});

/**
 * Explicit chain registry.
 *
 * Security notes:
 * - `transactionsEnabled` is a hard gate: it stays false on every chain until
 *   the relevant MAINNET_CHECKLIST.md gates pass. Phase one is read-only.
 * - RPC endpoints come from viem's built-in, community-maintained chain
 *   definitions. No RPC URL is invented in this repository. User-configurable
 *   custom RPC endpoints arrive in a later phase.
 * - Chain IDs are taken from viem's canonical definitions and cross-checked
 *   in unit tests against the documented values (Sepolia 11155111, mainnet 1).
 */
const REGISTRY_INPUT: ChainMeta[] = [
  {
    chainId: sepolia.id,
    name: sepolia.name,
    testnet: true,
    enabled: true,
    transactionsEnabled: false,
  },
  {
    // Mainnet is listed so the UI can NAME it when a wallet is connected to it
    // (wrong-network warning). It is not enabled for app features in phase one.
    chainId: mainnet.id,
    name: mainnet.name,
    testnet: false,
    enabled: false,
    transactionsEnabled: false,
  },
];

export const CHAIN_REGISTRY: readonly ChainMeta[] = REGISTRY_INPUT.map((m) =>
  chainMetaSchema.parse(m),
);

export const VIEM_CHAINS: Readonly<Record<number, Chain>> = {
  [sepolia.id]: sepolia,
  [mainnet.id]: mainnet,
};

/** Ethereum Sepolia — the phase-one development and testing network. */
export const DEFAULT_CHAIN_ID: number = sepolia.id;

export function getChainMeta(chainId: number): ChainMeta | undefined {
  return CHAIN_REGISTRY.find((c) => c.chainId === chainId);
}

/** True only for chains enabled for use in the app. */
export function isSupportedChain(chainId: number): boolean {
  return getChainMeta(chainId)?.enabled ?? false;
}

/** Hard read-only gate. Unknown chains are always false. */
export function transactionsEnabled(chainId: number): boolean {
  return getChainMeta(chainId)?.transactionsEnabled ?? false;
}

/** Best-effort human name for a chain the user may be connected to. */
export function chainDisplayName(chainId: number): string {
  return VIEM_CHAINS[chainId]?.name ?? `Unknown network (chain ID ${chainId})`;
}

/** Block-explorer address URL from viem's chain data; undefined when unknown. */
export function explorerAddressUrl(chainId: number, address: string): string | undefined {
  const base = VIEM_CHAINS[chainId]?.blockExplorers?.default?.url;
  return base ? `${base.replace(/\/$/, '')}/address/${address}` : undefined;
}

/** Block-explorer transaction URL from viem's chain data; undefined when unknown. */
export function explorerTxUrl(chainId: number, txHash: string): string | undefined {
  const base = VIEM_CHAINS[chainId]?.blockExplorers?.default?.url;
  return base ? `${base.replace(/\/$/, '')}/tx/${txHash}` : undefined;
}
