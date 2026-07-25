'use client';

import { useAccount } from 'wagmi';
import { chainDisplayName, isSupportedChain, transactionsEnabled } from '@omikami/chain-config';
import { buildSecurityStatus } from '@omikami/security';
import { Panel, StatusBadge } from '@omikami/ui';

export function SecurityPanel() {
  const account = useAccount();
  const chainId = account.chainId;

  const checks = buildSecurityStatus({
    connected: account.status === 'connected',
    ...(chainId !== undefined ? { chainId, chainName: chainDisplayName(chainId) } : {}),
    chainSupported: chainId !== undefined ? isSupportedChain(chainId) : false,
    transactionsEnabled: chainId !== undefined ? transactionsEnabled(chainId) : false,
    persistenceEnabled: false, // hardcoded off in phase one; opt-in arrives later
  });

  return (
    <Panel title="OMIKAMI SHIELD — security status">
      <ul className="flex flex-col gap-4">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-3">
            <StatusBadge status={check.status} />
            <div>
              <p className="text-sm font-medium">{check.label}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-[var(--omi-muted)]">
                {check.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-5 border-t border-[var(--omi-border)] pt-3 text-xs leading-relaxed text-[var(--omi-muted)]">
        These checks describe this application build. They are not an audit, and no interface can
        make wallet use risk-free. Your wallet is always the final authority on what gets signed.
      </p>
    </Panel>
  );
}
