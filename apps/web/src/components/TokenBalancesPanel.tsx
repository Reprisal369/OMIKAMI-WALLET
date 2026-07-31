'use client';

import { erc20Abi } from 'viem';
import { useAccount, useReadContracts } from 'wagmi';
import { DEFAULT_CHAIN_ID, explorerAddressUrl } from '@omikami/chain-config';
import { emphasizeAddress } from '@omikami/security';
import { VERIFIED_TOKENS, formatTokenAmount, sanitizeTokenText } from '@omikami/token-registry';
import { CopyButton, Panel, StatusBadge } from '@omikami/ui';

const TOKENS = VERIFIED_TOKENS.filter((t) => t.chainId === DEFAULT_CHAIN_ID);

function ShortAddress({ address }: { address: string }) {
  const { start, end } = emphasizeAddress(address, 6, 4);
  return (
    <span className="font-mono text-xs text-[var(--omi-muted)]" title={address}>
      {start}…{end}
    </span>
  );
}

/**
 * Read-only ERC-20 balances for the reviewed token registry (Sepolia only).
 * Token identity is chainId + checksummed address; symbol/name are display
 * strings from the reviewed registry, sanitized before rendering.
 */
export function TokenBalancesPanel() {
  const account = useAccount();
  const onSepolia = account.status === 'connected' && account.chainId === DEFAULT_CHAIN_ID;
  const enabled = onSepolia && Boolean(account.address) && TOKENS.length > 0;

  const reads = useReadContracts({
    contracts: TOKENS.map((t) => ({
      abi: erc20Abi,
      address: t.address as `0x${string}`,
      chainId: DEFAULT_CHAIN_ID,
      functionName: 'balanceOf' as const,
      args: [account.address as `0x${string}`],
    })),
    query: { enabled },
  });

  return (
    <Panel title="Token balances">
      {TOKENS.length === 0 && (
        <p className="text-sm text-[var(--omi-muted)]">
          No tokens have passed verification for this network yet. Tokens are added to the registry
          only with recorded verification evidence.
        </p>
      )}

      {TOKENS.length > 0 && account.status !== 'connected' && (
        <p className="text-sm text-[var(--omi-muted)]">
          Connect a wallet to view your token balances on Ethereum Sepolia.
        </p>
      )}

      {TOKENS.length > 0 && account.status === 'connected' && !onSepolia && (
        <p className="text-sm text-[var(--omi-warn)]" role="status">
          Token balances load on Ethereum Sepolia only. Switch the network inside your wallet if
          you intend to view them.
        </p>
      )}

      {enabled && (
        <ul className="divide-y divide-[var(--omi-border)]">
          {TOKENS.map((token, index) => {
            const result = reads.data?.[index];
            const explorer = explorerAddressUrl(token.chainId, token.address);
            return (
              <li key={`${token.chainId}:${token.address}`} className="flex flex-col gap-1 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium">{sanitizeTokenText(token.symbol)}</span>
                    <span className="text-xs text-[var(--omi-muted)]">
                      {sanitizeTokenText(token.name, 40)}
                    </span>
                    {token.status === 'verified' ? (
                      <span className="flex items-center gap-1">
                        <StatusBadge status="ok" />
                        <span className="text-xs text-[var(--omi-ok)]">Verified</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <StatusBadge status="warning" />
                        <span className="text-xs text-[var(--omi-warn)]">Unverified</span>
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-sm">
                    {reads.isPending && <span className="text-[var(--omi-muted)]">Loading…</span>}
                    {result?.status === 'success' && (
                      <>
                        {formatTokenAmount(result.result as bigint, token.decimals)}{' '}
                        {sanitizeTokenText(token.symbol)}
                      </>
                    )}
                    {(result?.status === 'failure' || (reads.isError && !result)) && (
                      <span className="text-[var(--omi-warn)]">
                        Could not read this balance.{' '}
                        <button
                          type="button"
                          className="underline"
                          onClick={() => void reads.refetch()}
                        >
                          Retry
                        </button>
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ShortAddress address={token.address} />
                  <CopyButton value={token.address} />
                  {explorer && (
                    <a
                      href={explorer}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View ${sanitizeTokenText(token.symbol)} contract on block explorer`}
                      className="text-xs text-[var(--omi-gold)] underline decoration-[var(--omi-gold-dim)] underline-offset-4"
                    >
                      Explorer
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 border-t border-[var(--omi-border)] pt-3 text-xs leading-relaxed text-[var(--omi-muted)]">
        Read-only. Token identity is always the contract address — never trust a name or symbol by
        itself. Unsolicited or unknown tokens are never shown as trustworthy.
      </p>
    </Panel>
  );
}
