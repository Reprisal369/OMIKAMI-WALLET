'use client';

import { useBlockNumber } from 'wagmi';
import { DEFAULT_CHAIN_ID, chainDisplayName } from '@omikami/chain-config';
import { KeyValue, Panel, StatusBadge } from '@omikami/ui';

/**
 * Read-only RPC health: fetches the latest Sepolia block number through the
 * configured public transport. This is the only network read the app makes
 * before a wallet is connected.
 */
export function RpcStatusPanel() {
  const block = useBlockNumber({
    chainId: DEFAULT_CHAIN_ID,
    query: { retry: 1, refetchInterval: 30_000 },
  });

  const status = block.isPending ? 'checking' : block.isError ? 'error' : 'connected';

  return (
    <Panel title="RPC connection">
      <dl className="divide-y divide-[var(--omi-border)]">
        <KeyValue label="Network">
          {chainDisplayName(DEFAULT_CHAIN_ID)} · Chain ID {DEFAULT_CHAIN_ID}
        </KeyValue>
        <KeyValue label="Status">
          {status === 'checking' && <span className="text-[var(--omi-muted)]">Checking…</span>}
          {status === 'connected' && (
            <span className="flex items-center gap-2">
              <StatusBadge status="ok" />
              <span>
                Connected · latest block{' '}
                <span className="font-mono">{block.data?.toString()}</span>
              </span>
            </span>
          )}
          {status === 'error' && (
            <span className="flex items-center gap-2 text-[var(--omi-warn)]">
              <StatusBadge status="warning" />
              <span>
                RPC endpoint unreachable or timed out.{' '}
                <button type="button" className="underline" onClick={() => void block.refetch()}>
                  Retry
                </button>
              </span>
            </span>
          )}
        </KeyValue>
        <KeyValue label="Endpoint source">
          viem default public endpoint (user-configurable endpoints arrive in a later phase)
        </KeyValue>
      </dl>
    </Panel>
  );
}
