'use client';

import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import { useAccount, useBalance, useConnect, useDisconnect, useEnsName } from 'wagmi';
import {
  chainDisplayName,
  explorerAddressUrl,
  getChainMeta,
  isSupportedChain,
} from '@omikami/chain-config';
import { classifyConnectError, connectFailureMessage, emphasizeAddress } from '@omikami/security';
import { ActionButton, KeyValue, Panel } from '@omikami/ui';

const CONNECT_TIMEOUT_MS = 30_000;

/** True once an EIP-1193 provider is detected. Runs client-side only. */
function useInjectedProviderDetected(): boolean | undefined {
  const [detected, setDetected] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    setDetected(typeof window !== 'undefined' && 'ethereum' in window);
  }, []);
  return detected;
}

function AddressDisplay({ address }: { address: string }) {
  const { start, middle, end } = emphasizeAddress(address, 6, 4);
  return (
    <span className="break-all font-mono text-sm" title={address}>
      <strong className="text-[var(--omi-gold)]">{start}</strong>
      <span className="text-[var(--omi-muted)]">{middle}</span>
      <strong className="text-[var(--omi-gold)]">{end}</strong>
    </span>
  );
}

export function ConnectPanel() {
  const account = useAccount();
  const { connectors, connect, status: connectStatus, error: connectError, reset } = useConnect();
  const { disconnect } = useDisconnect();
  const injectedDetected = useInjectedProviderDetected();
  const [timedOut, setTimedOut] = useState(false);
  const [copied, setCopied] = useState(false);

  const isPending = connectStatus === 'pending';

  // Dedupe connectors: when the same wallet is discovered via EIP-6963,
  // wagmi also keeps the generic "injected" fallback — hide the fallback so
  // each installed wallet appears exactly once, under its own name.
  const discovered = connectors.filter((c) => c.id !== 'injected');
  const visibleConnectors = discovered.length > 0 ? discovered : [...connectors];

  // Timeout state: if the wallet prompt hangs, tell the user what to do.
  useEffect(() => {
    if (!isPending) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), CONNECT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isPending]);

  const balance = useBalance({
    address: account.address,
    query: { enabled: Boolean(account.address) },
  });

  // ENS is resolved on Ethereum mainnet (read-only), where ENS lives.
  const ens = useEnsName({
    address: account.address,
    chainId: 1,
    query: { enabled: Boolean(account.address) },
  });

  // --- Disconnected states -------------------------------------------------
  if (account.status === 'disconnected' || account.status === 'connecting') {
    const failureKind = connectError ? classifyConnectError(connectError) : undefined;
    return (
      <Panel title="Wallet" tone="gold">
        <p className="mb-4 text-sm text-[var(--omi-muted)]">
          Connect an injected browser wallet (MetaMask, Rabby, Coinbase Wallet extension, or
          compatible). OMIKAMI WALLET is non-custodial:{' '}
          <span className="text-[var(--omi-text)]">
            it will never ask for your seed phrase or private key
          </span>
          , and this read-only build cannot send transactions or request signatures.
        </p>

        {injectedDetected === false && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-[rgba(214,158,46,0.45)] bg-[rgba(214,158,46,0.08)] p-3 text-sm text-[var(--omi-warn)]"
          >
            No injected wallet detected in this browser. Install a compatible wallet extension and
            reload this page. Never enter a seed phrase into a website to “connect” — that is
            always a scam.
          </div>
        )}

        {isPending && (
          <div role="status" className="mb-4 text-sm text-[var(--omi-muted)]">
            Waiting for your wallet… Check the wallet extension popup and approve or reject the
            connection there.
            {timedOut && (
              <span className="mt-2 block text-[var(--omi-warn)]">
                This is taking longer than expected. The request may have timed out or the popup
                may be hidden — open your wallet extension directly, then try again.
              </span>
            )}
          </div>
        )}

        {connectError && !isPending && failureKind && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-[var(--omi-border)] bg-[rgba(140,150,170,0.06)] p-3 text-sm text-[var(--omi-text)]"
          >
            {connectFailureMessage(failureKind)}
          </div>
        )}

        {/*
          Wallet buttons render only AFTER client-side detection completes
          (injectedDetected !== undefined). This avoids a React hydration
          mismatch: the prerendered HTML knows nothing about the user's
          wallets, while the client may discover extra EIP-6963 connectors.
        */}
        {injectedDetected === undefined ? (
          <p className="text-sm text-[var(--omi-muted)]" role="status">
            Detecting wallets…
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {visibleConnectors.map((connector) => (
              <ActionButton
                key={connector.uid}
                disabled={isPending || injectedDetected === false}
                onClick={() => {
                  reset();
                  connect({ connector });
                }}
              >
                {isPending
                  ? 'Waiting for wallet…'
                  : connector.name && connector.name !== 'Injected'
                    ? `Connect ${connector.name}`
                    : 'Connect wallet'}
              </ActionButton>
            ))}
          </div>
        )}
      </Panel>
    );
  }

  // --- Connected state ------------------------------------------------------
  const chainId = account.chainId;
  const chainMeta = chainId !== undefined ? getChainMeta(chainId) : undefined;
  const wrongNetwork = chainId !== undefined && !isSupportedChain(chainId);
  const explorer =
    chainId !== undefined && account.address
      ? explorerAddressUrl(chainId, account.address)
      : undefined;

  return (
    <Panel title="Wallet" tone="gold">
      {wrongNetwork && chainId !== undefined && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-[rgba(214,158,46,0.45)] bg-[rgba(214,158,46,0.08)] p-3 text-sm text-[var(--omi-warn)]"
        >
          Your wallet is connected to {chainDisplayName(chainId)} (chain ID {chainId}), which this
          read-only build does not support. Supported network: Ethereum Sepolia (testnet).
          OMIKAMI WALLET never switches networks for you — if you intend to use Sepolia, switch
          inside your wallet.
        </div>
      )}

      <dl className="divide-y divide-[var(--omi-border)]">
        <KeyValue label="Address">
          <span className="flex flex-wrap items-center gap-2">
            {account.address ? <AddressDisplay address={account.address} /> : '—'}
            {account.address && (
              <button
                type="button"
                className="rounded border border-[var(--omi-border)] px-2 py-0.5 text-xs text-[var(--omi-muted)] hover:text-[var(--omi-text)]"
                onClick={() => {
                  void navigator.clipboard.writeText(account.address as string).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </span>
        </KeyValue>

        {ens.data && (
          <KeyValue label="ENS name">
            <span className="font-mono text-sm">{ens.data}</span>
          </KeyValue>
        )}

        <KeyValue label="Network">
          {chainId !== undefined ? (
            <span className={wrongNetwork ? 'text-[var(--omi-warn)]' : ''}>
              {chainDisplayName(chainId)} · Chain ID {chainId}
              {chainMeta?.testnet ? ' · Testnet' : ''}
            </span>
          ) : (
            '—'
          )}
        </KeyValue>

        <KeyValue label="Native balance">
          {balance.isLoading && <span className="text-[var(--omi-muted)]">Loading…</span>}
          {balance.isError && (
            <span className="text-[var(--omi-warn)]">
              Could not read the balance from the RPC endpoint.{' '}
              <button type="button" className="underline" onClick={() => void balance.refetch()}>
                Retry
              </button>
            </span>
          )}
          {balance.data && (
            <span className="font-mono">
              {formatUnits(balance.data.value, balance.data.decimals)} {balance.data.symbol}
            </span>
          )}
        </KeyValue>

        <KeyValue label="Connection source">
          {account.connector?.name ?? 'Injected wallet'}
        </KeyValue>

        {explorer && (
          <KeyValue label="Block explorer">
            <a
              href={explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--omi-gold)] underline decoration-[var(--omi-gold-dim)] underline-offset-4"
            >
              View address on explorer
            </a>
          </KeyValue>
        )}
      </dl>

      <div className="mt-5">
        <ActionButton variant="danger" onClick={() => disconnect()}>
          Disconnect wallet
        </ActionButton>
      </div>
    </Panel>
  );
}
