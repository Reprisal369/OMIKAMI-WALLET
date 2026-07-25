'use client';

import { useMemo, useState } from 'react';
import { erc20Abi } from 'viem';
import { useAccount, useBalance, useReadContract } from 'wagmi';
import { DEFAULT_CHAIN_ID } from '@omikami/chain-config';
import { buildSendPreview, emphasizeAddress } from '@omikami/security';
import type { SendPreviewAsset } from '@omikami/security';
import { VERIFIED_TOKENS, formatTokenAmount, sanitizeTokenText } from '@omikami/token-registry';
import { Panel, StatusBadge } from '@omikami/ui';

/**
 * Read-only transfer PREVIEW. This panel never signs or broadcasts anything:
 * it feeds the user's typed recipient and amount into pure SHIELD validators
 * (packages/security) and shows what a transfer WOULD look like, with
 * warnings, before any signing could ever happen. There is deliberately no
 * submit/send/sign control here — signing is disabled for the whole build.
 */

const TOKENS = VERIFIED_TOKENS.filter((t) => t.chainId === DEFAULT_CHAIN_ID);

function EmphAddress({ address }: { address: string }) {
  const { start, middle, end } = emphasizeAddress(address, 6, 4);
  return (
    <span className="break-all font-mono text-xs" title={address}>
      <strong className="text-[var(--omi-gold)]">{start}</strong>
      <span className="text-[var(--omi-muted)]">{middle}</span>
      <strong className="text-[var(--omi-gold)]">{end}</strong>
    </span>
  );
}

export function SendPreviewPanel() {
  const account = useAccount();
  const onSepolia = account.status === 'connected' && account.chainId === DEFAULT_CHAIN_ID;

  const [selected, setSelected] = useState<string>('native');
  const [recipientInput, setRecipientInput] = useState('');
  const [amountInput, setAmountInput] = useState('');

  const token = TOKENS.find((t) => t.address === selected);
  const isErc20 = Boolean(token);

  // Native balance (only when connected on Sepolia).
  const nativeBalance = useBalance({
    address: account.address,
    query: { enabled: onSepolia && Boolean(account.address) },
  });

  // Selected-token balance.
  const tokenBalance = useReadContract({
    abi: erc20Abi,
    address: token?.address as `0x${string}` | undefined,
    chainId: DEFAULT_CHAIN_ID,
    functionName: 'balanceOf',
    args: account.address ? [account.address] : undefined,
    query: { enabled: onSepolia && isErc20 && Boolean(account.address) },
  });

  const asset: SendPreviewAsset = token
    ? {
        kind: 'erc20',
        symbol: sanitizeTokenText(token.symbol),
        decimals: token.decimals,
        contractAddress: token.address,
        verified: token.status === 'verified',
      }
    : { kind: 'native', symbol: 'SepoliaETH', decimals: 18, verified: true };

  const availableBalance: bigint | undefined = token
    ? tokenBalance.data
    : nativeBalance.data?.value;

  // Known addresses for the poisoning heuristic: the user's own address plus
  // every registry contract address. Never used as an allowlist.
  const knownAddresses = useMemo(() => {
    const list: string[] = TOKENS.map((t) => t.address);
    if (account.address) list.push(account.address);
    return list;
  }, [account.address]);

  const preview = buildSendPreview({
    ...(account.address ? { fromAddress: account.address } : {}),
    recipientInput,
    amountInput,
    asset,
    ...(availableBalance !== undefined ? { availableBalance } : {}),
    knownAddresses,
    // Hard invariant: this build never enables transactions.
    transactionsEnabled: false,
  });

  const showChecks = recipientInput.trim().length > 0 || amountInput.trim().length > 0;

  return (
    <Panel title="Transfer preview (read-only)">
      <div
        role="note"
        className="mb-4 rounded-lg border border-[var(--omi-gold-dim)] bg-[rgba(201,162,74,0.08)] p-3 text-sm text-[var(--omi-gold)]"
      >
        Preview only. This build cannot sign or broadcast — there is no way to move funds from this
        screen. Type a recipient and amount to see how OMIKAMI SHIELD would check the transfer.
      </div>

      {account.status !== 'connected' && (
        <p className="mb-4 text-sm text-[var(--omi-muted)]">
          Connect a wallet to preview a transfer from your address. You can still see the checks
          below.
        </p>
      )}

      {account.status === 'connected' && !onSepolia && (
        <p className="mb-4 text-sm text-[var(--omi-warn)]" role="status">
          Balance checks run on Ethereum Sepolia only. Switch the network inside your wallet to
          preview against your funds.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--omi-muted)]">Asset</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-lg border border-[var(--omi-border)] bg-[var(--omi-bg)] px-3 py-2 text-sm text-[var(--omi-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--omi-gold)]"
          >
            <option value="native">SepoliaETH (native)</option>
            {TOKENS.map((t) => (
              <option key={t.address} value={t.address}>
                {sanitizeTokenText(t.symbol)} — {sanitizeTokenText(t.name, 40)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--omi-muted)]">Recipient address</span>
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="0x…"
            value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value)}
            className="rounded-lg border border-[var(--omi-border)] bg-[var(--omi-bg)] px-3 py-2 font-mono text-sm text-[var(--omi-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--omi-gold)]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--omi-muted)]">Amount ({asset.symbol})</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            placeholder="0.0"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            className="rounded-lg border border-[var(--omi-border)] bg-[var(--omi-bg)] px-3 py-2 font-mono text-sm text-[var(--omi-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--omi-gold)]"
          />
        </label>
      </div>

      {onSepolia && availableBalance !== undefined && (
        <p className="mt-3 text-xs text-[var(--omi-muted)]">
          Available: {formatTokenAmount(availableBalance, asset.decimals)} {asset.symbol}
        </p>
      )}

      {showChecks && (
        <>
          {preview.recipient.valid && preview.recipient.checksummed && (
            <div className="mt-4 rounded-lg border border-[var(--omi-border)] bg-[rgba(140,150,170,0.05)] p-3">
              <p className="mb-1 text-xs uppercase tracking-wide text-[var(--omi-muted)]">
                Normalized recipient (EIP-55)
              </p>
              <EmphAddress address={preview.recipient.checksummed} />
            </div>
          )}

          <ul className="mt-4 flex flex-col gap-3">
            {preview.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-3">
                <StatusBadge status={c.status} />
                <div>
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-[var(--omi-muted)]">
                    {c.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div
            role="status"
            className={`mt-4 rounded-lg border p-3 text-sm ${
              preview.wouldBlock
                ? 'border-[rgba(200,80,80,0.45)] bg-[rgba(200,80,80,0.08)] text-[var(--omi-danger)]'
                : 'border-[rgba(74,164,110,0.35)] bg-[rgba(74,164,110,0.10)] text-[var(--omi-ok)]'
            }`}
          >
            {preview.wouldBlock
              ? 'A real wallet should not proceed with this transfer as entered — resolve the blocking issues above first.'
              : 'These inputs look consistent. Even so, nothing is signed here; a real transfer would still require your wallet’s explicit approval.'}
          </div>
        </>
      )}

      <p className="mt-4 border-t border-[var(--omi-border)] pt-3 text-xs leading-relaxed text-[var(--omi-muted)]">
        Read-only preview. These checks are heuristics, not a guarantee of safety, and they are not
        an audit. Signing is disabled across this entire build; your wallet is always the final
        authority on what gets signed.
      </p>
    </Panel>
  );
}
