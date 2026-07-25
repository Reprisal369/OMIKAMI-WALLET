/**
 * OMIKAMI SHIELD — pure activity/quarantine classification (phase 2b).
 * Input is decoded ERC-20 Transfer data; output separates activity involving
 * the user from UNKNOWN token contracts, which are quarantined and must never
 * be called automatically by the UI (THREAT_MODEL D3).
 */

export interface TransferRecord {
  /** Token contract address (lowercased for identity comparison). */
  token: string;
  from: string;
  to: string;
  value: bigint;
  blockNumber: bigint;
  txHash: string;
  logIndex: number;
}

export interface ActivityItem extends TransferRecord {
  direction: 'in' | 'out' | 'self';
  /** True when the token contract is in the reviewed registry. */
  registered: boolean;
}

export interface QuarantinedToken {
  token: string;
  transferCount: number;
  lastBlock: bigint;
}

export interface ActivitySummary {
  items: ActivityItem[];
  quarantined: QuarantinedToken[];
}

/**
 * Classifies transfers for a user address against the reviewed registry.
 * - Direction is computed case-insensitively.
 * - Items are de-duplicated by txHash+logIndex and sorted newest-first.
 * - Unknown token contracts are aggregated into the quarantine list.
 */
export function summarizeTransfers(
  transfers: readonly TransferRecord[],
  userAddress: string,
  registeredTokenAddresses: readonly string[],
): ActivitySummary {
  const user = userAddress.toLowerCase();
  const registry = new Set(registeredTokenAddresses.map((a) => a.toLowerCase()));
  const seen = new Set<string>();
  const items: ActivityItem[] = [];
  const quarantineMap = new Map<string, QuarantinedToken>();

  for (const t of transfers) {
    const key = `${t.txHash}:${t.logIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const from = t.from.toLowerCase();
    const to = t.to.toLowerCase();
    if (from !== user && to !== user) continue;

    const token = t.token.toLowerCase();
    const registered = registry.has(token);
    const direction: ActivityItem['direction'] =
      from === user && to === user ? 'self' : from === user ? 'out' : 'in';

    items.push({ ...t, token, from, to, direction, registered });

    if (!registered) {
      const existing = quarantineMap.get(token);
      if (existing) {
        existing.transferCount += 1;
        if (t.blockNumber > existing.lastBlock) existing.lastBlock = t.blockNumber;
      } else {
        quarantineMap.set(token, { token, transferCount: 1, lastBlock: t.blockNumber });
      }
    }
  }

  items.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber > b.blockNumber ? -1 : 1;
    return b.logIndex - a.logIndex;
  });

  return { items, quarantined: [...quarantineMap.values()] };
}
