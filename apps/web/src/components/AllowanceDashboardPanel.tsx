'use client';

import { useQuery } from '@tanstack/react-query';
import { erc20Abi, parseAbiItem } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';
import { DEFAULT_CHAIN_ID, explorerAddressUrl } from '@omikami/chain-config';
import {
  classifyAllowanceRisk,
  emphasizeAddress,
  summarizeApprovals,
  type ApprovalRecord,
} from '@omikami/security';
import { VERIFIED_TOKENS, formatTokenAmount, sanitizeTokenText } from '@omikami/token-registry';
import { CopyButton, Panel, StatusBadge } from '@omikami/ui';

/**
 * Read-only ERC-20 ALLOWANCE dashboard. It discovers which spenders the user
 * has approved from `Approval` event logs (chain data, not a contract call),
 * then reads the CURRENT allowance ONLY for tokens in the reviewed registry
 * via their verified contracts. Unknown token contracts are quarantined and
 * never called (THREAT_MODEL D3). Nothing here approves, revokes, or signs.
 */

const approvalEvent = parseAbiItem(
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
);

const LOOKBACK = 10_000n;
const CHUNK = 800n;
const LOOKBACK_LABEL = `~${Number(LOOKBACK).toLocaleString('en-US')} blocks`;

const REGISTRY = new Map(
  VERIFIED_TOKENS.filter((t) => t.chainId === DEFAULT_CHAIN_ID).map((t) => [
    t.address.toLowerCase(),
    t,
  ]),
);
const REGISTRY_ADDRESSES = [...REGISTRY.keys()];

interface AllowanceRowData {
  token: string;
  spender: string;
  value: bigint;
  status: ReturnType<typeof classifyAllowanceRisk>['status'];
  label: string;
  unlimited: boolean;
}

function Short({ value }: { value: string }) {
  const { start, end } = emphasizeAddress(value, 6, 4);
  return (
    <span className="font-mono text-xs" title={value}>
      {start}…{end}
    </span>
  );
}

export function AllowanceDashboardPanel() {
  const account = useAccount();
  const client = usePublicClient({ chainId: DEFAULT_CHAIN_ID });
  const onSepolia = account.status === 'connected' && account.chainId === DEFAULT_CHAIN_ID;
  const address = account.address;

  const query = useQuery({
    queryKey: ['allowances', DEFAULT_CHAIN_ID, address],
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

      // Discover approvals from LOGS (never a contract call). Sequential and
      // fault-tolerant: one bad range does not blank the dashboard.
      const rawLogs = [];
      let anyOk = false;
      for (const r of [...ranges].reverse()) {
        try {
          const logs = await client.getLogs({
            event: approvalEvent,
            args: { owner: address },
            fromBlock: r.from,
            toBlock: r.to,
          });
          rawLogs.push(...logs);
          anyOk = true;
        } catch {
          // ignore this range; continue
        }
      }
      if (!anyOk) throw new Error('eth_getLogs unsupported or rate-limited on this endpoint');

      const approvals: ApprovalRecord[] = rawLogs.map((log) => ({
        token: log.address,
        owner: (log.args.owner ?? '0x') as string,
        spender: (log.args.spender ?? '0x') as string,
        value: (log.args.value ?? 0n) as bigint,
        blockNumber: log.blockNumber ?? 0n,
        txHash: log.transactionHash ?? '',
        logIndex: log.logIndex ?? 0,
      }));

      const summary = summarizeApprovals(approvals, address, REGISTRY_ADDRESSES);

      // Read the LIVE allowance ONLY for reviewed-registry tokens, via their
      // verified contracts. Unknown tokens stay quarantined and uncalled.
      let rows: AllowanceRowData[] = [];
      if (summary.pairs.length > 0) {
        const contracts = summary.pairs.map((p) => {
          const meta = REGISTRY.get(p.token);
          return {
            abi: erc20Abi,
            address: (meta?.address ?? p.token) as `0x${string}`,
            functionName: 'allowance' as const,
            args: [address, p.spender as `0x${string}`] as const,
          };
        });
        const results = await client.multicall({ contracts, allowFailure: true });
        rows = summary.pairs.map((p, i) => {
          const res = results[i];
          const value = res && res.status === 'success' ? (res.result as bigint) : 0n;
          const risk = classifyAllowanceRisk({ value, tokenVerified: true });
          return {
            token: p.token,
            spender: p.spender,
            value,
            status: risk.status,
            label: risk.label,
            unlimited: risk.unlimited,
          };
        });
      }

      // Active allowances (value > 0), highest risk first (unlimited on top).
      const active = rows
        .filter((r) => r.value > 0n)
        .sort((a, b) => (b.unlimited ? 1 : 0) - (a.unlimited ? 1 : 0));
      const clearedCount = rows.length - active.length;

      return { active, clearedCount, quarantined: summary.quarantined };
    },
  });

  const active = query.data?.active ?? [];
  const quarantined = query.data?.quarantined ?? [];
  const clearedCount = query.data?.clearedCount ?? 0;

  return (
    <Panel title="Token allowances (read-only)">
      <p className="mb-4 text-sm text-[var(--omi-muted)]">
        Approvals let a spender move your tokens without asking again. This dashboard shows what
        you have approved so you can review it — it never approves, changes, or revokes anything.
      </p>

      {account.status !== 'connected' && (
        <p className="text-sm text-[var(--omi-muted)]">
          Connect a wallet to review token allowances on Ethereum Sepolia.
        </p>
      )}

      {account.status === 'connected' && !onSepolia && (
        <p className="text-sm text-[var(--omi-warn)]" role="status">
          Allowances load on Ethereum Sepolia only. Switch the network inside your wallet if you
          intend to view them.
        </p>
      )}

      {onSepolia && query.isPending && (
        <p className="text-sm text-[var(--omi-muted)]" role="status">
          Reading approval history from the chain…
        </p>
      )}

      {onSepolia && query.isError && (
        <p className="text-sm text-[var(--omi-warn)]" role="alert">
          This RPC endpoint did not return approval history (many free endpoints limit log
          queries). Your balances are unaffected.{' '}
          <button type="button" className="underline" onClick={() => void query.refetch()}>
            Retry
          </button>{' '}
          or set a full-history endpoint in Settings.
        </p>
      )}

      {onSepolia && query.isSuccess && active.length === 0 && (
        <p className="text-sm text-[var(--omi-muted)]">
          No active token allowances found for reviewed tokens in the last {LOOKBACK_LABEL}.
          {clearedCount > 0
            ? ` (${clearedCount} previously-approved ${clearedCount === 1 ? 'spender is' : 'spenders are'} already at zero.)`
            : ''}
        </p>
      )}

      {active.length > 0 && (
        <ul className="flex flex-col gap-3">
          {active.map((row) => {
            const meta = REGISTRY.get(row.token);
            const symbol = meta ? sanitizeTokenText(meta.symbol) : 'Unknown';
            const name = meta ? sanitizeTokenText(meta.name, 40) : 'Unknown token';
            const spenderUrl = explorerAddressUrl(DEFAULT_CHAIN_ID, row.spender);
            return (
              <li
                key={`${row.token}:${row.spender}`}
                className="rounded-lg border border-[var(--omi-border)] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium">{symbol}</span>
                    <span className="text-xs text-[var(--omi-muted)]">{name}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <StatusBadge status={row.status} />
                    <span
                      className={`text-xs ${
                        row.status === 'blocked'
                          ? 'text-[var(--omi-danger)]'
                          : row.status === 'warning'
                            ? 'text-[var(--omi-warn)]'
                            : 'text-[var(--omi-muted)]'
                      }`}
                    >
                      {row.label}
                    </span>
                  </span>
                </div>

                <dl className="mt-2 flex flex-col gap-1 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <dt className="text-[var(--omi-muted)]">Spender</dt>
                    <dd className="flex items-center gap-2">
                      <Short value={row.spender} />
                      <CopyButton value={row.spender} />
                      {spenderUrl && (
                        <a
                          href={spenderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[var(--omi-gold)] underline decoration-[var(--omi-gold-dim)] underline-offset-4"
                        >
                          Explorer
                        </a>
                      )}
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <dt className="text-[var(--omi-muted)]">Current allowance</dt>
                    <dd className="font-mono">
                      {row.unlimited
                        ? 'Unlimited (max)'
                        : meta
                          ? `${formatTokenAmount(row.value, meta.decimals)} ${symbol}`
                          : row.value.toString()}
                    </dd>
                  </div>
                </dl>

                {row.unlimited && (
                  <p
                    role="alert"
                    className="mt-2 rounded border border-[rgba(200,80,80,0.45)] bg-[rgba(200,80,80,0.08)] p-2 text-xs leading-relaxed text-[var(--omi-danger)]"
                  >
                    Unlimited allowance: this spender can move your entire {symbol} balance, now and
                    in the future, until you revoke it in your wallet. Only leave this in place for
                    contracts you actively use and trust.
                  </p>
                )}

                {meta && (
                  <p className="mt-2 text-xs leading-relaxed text-[var(--omi-muted)]">
                    <span className="text-[var(--omi-ok)]">Verified token.</span> Source:{' '}
                    <span title={meta.evidence}>{sanitizeTokenText(meta.evidence, 80)}</span>
                  </p>
                )}
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
            Approvals to unknown token contracts (quarantined)
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--omi-muted)]">
            You approved a spender on a token that is NOT in the reviewed registry. OMIKAMI WALLET
            never calls unknown contracts, so their live allowance is not read here. Treat these as
            suspicious — review them on the explorer and revoke in your wallet if unexpected.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {quarantined.map((q) => {
              const tokenUrl = explorerAddressUrl(DEFAULT_CHAIN_ID, q.token);
              const spenderUrl = explorerAddressUrl(DEFAULT_CHAIN_ID, q.spender);
              return (
                <li
                  key={`${q.token}:${q.spender}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                >
                  <span className="text-[var(--omi-muted)]">token</span>
                  <Short value={q.token} />
                  {tokenUrl && (
                    <a
                      href={tokenUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--omi-gold)] underline decoration-[var(--omi-gold-dim)] underline-offset-4"
                    >
                      ↗
                    </a>
                  )}
                  <span className="text-[var(--omi-muted)]">spender</span>
                  <Short value={q.spender} />
                  {spenderUrl && (
                    <a
                      href={spenderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--omi-gold)] underline decoration-[var(--omi-gold-dim)] underline-offset-4"
                    >
                      ↗
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mt-4 border-t border-[var(--omi-border)] pt-3 text-xs leading-relaxed text-[var(--omi-muted)]">
        Read-only. Discovered from Approval logs ({LOOKBACK_LABEL}); live values read only for
        reviewed tokens. Risk labels are heuristics, not an audit. To change or revoke an
        allowance, use your own wallet — this build never signs.
      </p>
    </Panel>
  );
}
