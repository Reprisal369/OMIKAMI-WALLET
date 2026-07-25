/**
 * OMIKAMI SHIELD — read-only ERC-20 ALLOWANCE analysis.
 *
 * Pure and side-effect free. Discovers which (token, spender) pairs a user has
 * approved from `Approval` event LOGS (chain data, not a contract call),
 * dedupes them, and separates registry tokens (whose live allowance may be
 * read from their verified contract) from unknown tokens (which are
 * QUARANTINED and never called — THREAT_MODEL D3).
 *
 * This module never signs, approves, or revokes anything. Risk labels are
 * heuristics, never confirmed verdicts.
 */
import type { SecurityCheckStatus } from '@omikami/types';

// ---------------------------------------------------------------------------
// Unlimited-allowance detection
// ---------------------------------------------------------------------------

/**
 * Allowances at or above this are treated as effectively unlimited. Covers the
 * common MAX_UINT256 (2^256-1) approval and "half-max" variants — any of these
 * is so large it never depletes in practice, so the distinction is moot.
 */
export const UNLIMITED_THRESHOLD = 2n ** 255n;

export function isUnlimitedAllowance(value: bigint): boolean {
  return value >= UNLIMITED_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Risk classification
// ---------------------------------------------------------------------------

export interface AllowanceRisk {
  status: SecurityCheckStatus;
  /** Short badge label. */
  label: string;
  unlimited: boolean;
}

/**
 * Classifies the risk of a single live allowance. Never says "safe": a finite
 * allowance on a reviewed token is the LOWEST risk shown, not a guarantee.
 */
export function classifyAllowanceRisk(input: {
  value: bigint;
  tokenVerified: boolean;
}): AllowanceRisk {
  if (input.value === 0n) {
    return { status: 'ok', label: 'No active allowance', unlimited: false };
  }
  if (isUnlimitedAllowance(input.value)) {
    return { status: 'blocked', label: 'Unlimited', unlimited: true };
  }
  if (!input.tokenVerified) {
    return { status: 'warning', label: 'Unverified token', unlimited: false };
  }
  return { status: 'info', label: 'Limited', unlimited: false };
}

// ---------------------------------------------------------------------------
// Approval-log summary
// ---------------------------------------------------------------------------

export interface ApprovalRecord {
  /** ERC-20 contract address (the log's emitting address). */
  token: string;
  owner: string;
  spender: string;
  /** Approved value from the LOG. May be stale — always re-read live before display. */
  value: bigint;
  blockNumber: bigint;
  txHash: string;
  logIndex: number;
}

export interface DiscoveredPair {
  /** Lowercased token contract address. */
  token: string;
  /** Lowercased spender address. */
  spender: string;
  lastBlock: bigint;
}

export interface QuarantinedApproval {
  token: string;
  spender: string;
  approvalCount: number;
  lastBlock: bigint;
}

export interface ApprovalSummary {
  /** Unique (token, spender) pairs for registry tokens, newest-first. */
  pairs: DiscoveredPair[];
  /** Unknown-token approvals — listed by address only, NEVER queried. */
  quarantined: QuarantinedApproval[];
}

function eq(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Reduces raw Approval logs (for one owner) into unique, deduped (token,
 * spender) pairs, partitioned into reviewed-registry tokens and quarantined
 * unknown tokens. Latest block wins per pair. Pure: identical input → identical
 * output.
 */
export function summarizeApprovals(
  approvals: ApprovalRecord[],
  userAddress: string,
  registeredTokenAddresses: readonly string[],
): ApprovalSummary {
  const registry = new Set(registeredTokenAddresses.map((a) => a.toLowerCase()));

  const pairMap = new Map<string, DiscoveredPair>();
  const quarantineMap = new Map<string, QuarantinedApproval>();

  for (const a of approvals) {
    if (!eq(a.owner, userAddress)) continue;
    const token = a.token.toLowerCase();
    const spender = a.spender.toLowerCase();
    const key = `${token}:${spender}`;

    if (registry.has(token)) {
      const existing = pairMap.get(key);
      if (!existing || a.blockNumber > existing.lastBlock) {
        pairMap.set(key, { token, spender, lastBlock: a.blockNumber });
      }
    } else {
      const existing = quarantineMap.get(key);
      if (existing) {
        existing.approvalCount += 1;
        if (a.blockNumber > existing.lastBlock) existing.lastBlock = a.blockNumber;
      } else {
        quarantineMap.set(key, {
          token,
          spender,
          approvalCount: 1,
          lastBlock: a.blockNumber,
        });
      }
    }
  }

  const pairs = [...pairMap.values()].sort((x, y) =>
    y.lastBlock > x.lastBlock ? 1 : y.lastBlock < x.lastBlock ? -1 : 0,
  );
  const quarantined = [...quarantineMap.values()].sort((x, y) =>
    y.lastBlock > x.lastBlock ? 1 : y.lastBlock < x.lastBlock ? -1 : 0,
  );

  return { pairs, quarantined };
}
