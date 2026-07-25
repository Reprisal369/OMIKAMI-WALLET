'use client';

import { useQuery } from '@tanstack/react-query';
import { parseAbiItem } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';
import { DEFAULT_CHAIN_ID, explorerAddressUrl, explorerTxUrl } from '@omikami/chain-config';
import { summarizeTransfers, type TransferRecord } from '@omikami/security';
import { VERIFIED_TOKENS, formatTokenAmount, sanitizeTokenText } from '@omikami/token-registry';
import { Panel, StatusBadge } from '@omikami/ui';

const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
);

/**
 * Look back a modest window in small chunks. Many free public RPCs cap
 * eth_getLogs block ranges (commonly ~800–2000) and rate-limit parallel
 * calls, so we keep ranges small and fetch sequentially. A user-configured
 * endpoint (Settings) can widen this in practice.
 */
const LOOKBACK = 10_000n;
const CHUNK = 800n;
/** Human label derived from LOOKBACK so UI text can never disagree with code. */
const LOOKBACK_LABEL = `~${Number(LOOKBACK).toLocaleString('en-US')} blocks`;

const REGISTRY = new Map(
  VERIFIED_TOKENS.filter((t) => t.chainId === DEFAULT_CHAIN_ID).map((t) => [
    t.address.toLowerCase(),
    t,
  ]),
);

function Short({ value }: { value: string }) {
  return (
    <span className="font-mono" title={value}>
      {value.slice(0, 6)}…{value.slice(-4)}
    </span>
  );
}

/**
 * Read-only recent ERC-20 activity, read directly from the chain via
 * eth_getLogs — no indexer, no third party. Native ETH transfers emit no
 * logs; the explorer link below covers full history. Unknown token contracts
 * are quarantined and are NEVER called by this application (THREAT_MODEL D3).
 */
export function ActivityPanel() {
  const account = useAccount();
  const client = usePublicClient({ chainId: DEFAULT_CHAIN_ID });
  const onSepolia = account.status === 'connected' && account.chainId === DEFAULT_CHAIN_ID;
  const address = account.address;

  const activity = useQuery({
    queryKey: ['activity', DEFAULT_CHAIN_ID, address],
    enabled: Boolean(onSepolia && address && client),
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      if (!client || !address) throw new Error('not ready');
      const latest = await client.getBlockNumber();
      const start = latest > LOOKBACK ? latest - LOOKBACK : 0n;
      const ranges: { from: bigint; to: bigint }[] = [];
      for (let from = start; from <= latest; from += CHUNK + 1n) {
        ranges.push({ from, to: from + CHUNK > latest ? latest : from + CHUNK });
      }
      // Sequential newest-first; tolerate per-range failures so one rejected
      // chunk does not blank the whole feed. If EVERY range fails, surface the
      // error so the panel shows its degraded state + explorer fallback.
      const rawLogs = [];
      let anyOk = false;
      for (const r of [...ranges].reverse()) {
        try {
          const [incoming, outgoing] = await Promise.all([
            client.getLogs({ event: transferEvent, args: { to: address }, fromBlock: r.from, toBlock: r.to }),
            client.getLogs({ event: transferEvent, args: { from: address }, fromBlock: r.from, toBlock: r.to }),
          ]);
          rawLogs.push(...incoming, ...outgoing);
          anyOk = true;
        } catch {
          // ignore this range; continue with the rest
        }
      }
      if (!anyOk) throw new Error('eth_getLogs unsupported or rate-limited on this endpoint');
      const transfers: TransferRecord[] = rawLogs.map((log) => ({
        token: log.address,
        from: (log.args.from ?? '0x') as string,
        to: (log.args.to ?? '0x') as string,
        value: (log.args.value ?? 0n) as bigint,
        blockNumber: log.blockNumber ?? 0n,
        txHash: log.transactionHash ?? '',
        logIndex: log.logIndex ?? 0,
      }));
      return summarizeTransfers(
        transfers,
        address,
        [...REGISTRY.keys()],
      );
    },
  });

  const explorer = address ? explorerAddressUrl(DEFAULT_CHAIN_ID, address) : undefined;
  const items = activity.data?.items.slice(0, 15) ?? [];
  const quarantined = activity.data?.quarantined ?? [];

  return (
    <Panel title="Recent token activity">
      {account.status !== 'connected' && (
        <p className="text-sm text-[var(--omi-muted)]">
          Connect a wallet to view recent token transfers on Ethereum Sepolia.
        </p>
      )}

      {account.status === 'connected' && !onSepolia && (
        <p className="text-sm text-[var(--omi-warn)]" role="status">
          Activity loads on Ethereum Sepolia only. Switch the network inside your wallet if you
          intend to view it.
        </p>
      )}

      {onSepolia && activity.isPending && (
        <p className="text-sm text-[var(--omi-muted)]" role="status">
          Reading recent blocks from the chain…
        </p>
      )}

      {onSepolia && activity.isError && (
        <p className="text-sm text-[var(--omi-warn)]" role="alert">
          This RPC endpoint did not return transfer history (many free endpoints
          limit or block log queries). Your balances above are unaffected.{' '}
          <button type="button" className="underline" onClick={() => void activity.refetch()}>
            Retry
          </button>
          {' '}or view full history via the explorer link below.
        </p>
      )}

      {onSepolia && activity.isSuccess && items.length === 0 && (
        <p className="text-sm text-[var(--omi-muted)]">
          No token transfers found in the last {LOOKBACK_LABEL}. Older transfers are
          on the chain — use the explorer link below, or set a full-history RPC endpoint in
          Settings.
        </p>
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-[var(--omi-border)]">
          {items.map((item) => {
            const meta = REGISTRY.get(item.token);
            const txUrl = explorerTxUrl(DEFAULT_CHAIN_ID, item.txHash);
            const counterparty = item.direction === 'in' ? item.from : item.to;
            return (
              <li
                key={`${item.txHash}:${item.logIndex}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={
                      item.direction === 'in'
                        ? 'text-[var(--omi-ok)]'
                        : 'text-[var(--omi-warn)]'
                    }
                  >
                    {item.direction === 'in' ? 'Received' : item.direction === 'out' ? 'Sent' : 'Self'}
                  </span>
                  <span className="font-mono">
                    {meta
                      ? `${formatTokenAmount(item.value, meta.decimals)} ${sanitizeTokenText(meta.symbol)}`
                      : `${item.value.toString()} (unknown token units)`}
                  </span>
                  {!meta && <StatusBadge status="warning" />}
                </span>
                <span className="flex items-center gap-3 text-xs text-[var(--omi-muted)]">
                  <span>
                    {item.direction === 'in' ? 'from' : 'to'} <Short value={counterparty} />
                  </span>
                  <span>block {item.blockNumber.toString()}</span>
                  {txUrl && (
                    <a
                      href={txUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--omi-gold)] underline decoration-[var(--omi-gold-dim)] underline-offset-4"
                    >
                      Tx
                    </a>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {quarantined.length > 0 && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-[rgba(214,158,46,0.45)] bg-[rgba(214,158,46,0.08)] p-3"
        >
          <p className="text-sm font-medium text-[var(--omi-warn)]">
            Unknown token contracts (quarantined)
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--omi-muted)]">
            These contracts sent tokens to your address but are NOT in the reviewed registry.
            OMIKAMI WALLET never calls unknown contracts. Do not interact with them; unsolicited
            tokens are a common phishing lure.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {quarantined.map((q) => {
              const url = explorerAddressUrl(DEFAULT_CHAIN_ID, q.token);
              return (
                <li key={q.token} className="flex flex-wrap items-center gap-3 text-xs">
                  <Short value={q.token} />
                  <span className="text-[var(--omi-muted)]">
                    {q.transferCount} transfer{q.transferCount === 1 ? '' : 's'}
                  </span>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--omi-gold)] underline decoration-[var(--omi-gold-dim)] underline-offset-4"
                    >
                      Explorer
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mt-4 border-t border-[var(--omi-border)] pt-3 text-xs leading-relaxed text-[var(--omi-muted)]">
        Recent token transfers only ({LOOKBACK_LABEL}), read directly from the chain. Native ETH
        transfers emit no logs
        {explorer ? (
          <>
            {' '}
            —{' '}
            <a
              href={explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--omi-gold)] underline decoration-[var(--omi-gold-dim)] underline-offset-4"
            >
              view full history on the explorer
            </a>
            .
          </>
        ) : (
          '.'
        )}
      </p>
    </Panel>
  );
}
