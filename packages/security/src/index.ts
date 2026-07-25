/**
 * OMIKAMI SHIELD — phase-one security primitives.
 * Pure functions only: no I/O, no key material, fully unit-testable.
 * Heuristics are surfaced as warnings, never as confirmed scam verdicts.
 */
import { getAddress, isAddress } from 'viem';
import type { ConnectFailureKind, SecurityCheck } from '@omikami/types';

// ---------------------------------------------------------------------------
// Address validation
// ---------------------------------------------------------------------------

export interface AddressValidation {
  valid: boolean;
  /** EIP-55 checksummed form, present only when valid. */
  checksummed?: `0x${string}`;
  reason?: 'empty' | 'format' | 'checksum';
}

/**
 * Validates a user-supplied address string.
 * - All-lowercase / all-uppercase hex is accepted and re-checksummed.
 * - Mixed-case input MUST pass EIP-55 exactly (guards against corrupted
 *   copy/paste and some poisoning tricks).
 */
export function validateAddress(input: string): AddressValidation {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { valid: false, reason: 'empty' };
  if (!isAddress(trimmed, { strict: false })) return { valid: false, reason: 'format' };
  const body = trimmed.slice(2);
  const hasUpper = /[A-F]/.test(body);
  const hasLower = /[a-f]/.test(body);
  if (hasUpper && hasLower && !isAddress(trimmed, { strict: true })) {
    return { valid: false, reason: 'checksum' };
  }
  return { valid: true, checksummed: getAddress(trimmed) };
}

// ---------------------------------------------------------------------------
// Address display (poisoning countermeasures)
// ---------------------------------------------------------------------------

export interface EmphasizedAddress {
  start: string;
  middle: string;
  end: string;
}

/**
 * Splits an address for first/last-character emphasis. Address-poisoning
 * victims typically compare only the ends, so the UI renders start/end
 * emphasized and the middle de-emphasized but NEVER hidden.
 */
export function emphasizeAddress(address: string, startChars = 6, endChars = 4): EmphasizedAddress {
  if (address.length <= startChars + endChars) {
    return { start: address, middle: '', end: '' };
  }
  return {
    start: address.slice(0, startChars),
    middle: address.slice(startChars, address.length - endChars),
    end: address.slice(address.length - endChars),
  };
}

/**
 * Poisoning heuristic: same visible prefix and suffix, different identity.
 * Returns true when two DIFFERENT addresses would look identical to a user
 * comparing only the emphasized ends.
 */
export function isLookalikeAddress(a: string, b: string, prefixChars = 6, suffixChars = 4): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (!x.startsWith('0x') || !y.startsWith('0x')) return false;
  if (x === y) return false;
  if (x.length !== y.length) return false;
  return (
    x.slice(0, prefixChars) === y.slice(0, prefixChars) &&
    x.slice(-suffixChars) === y.slice(-suffixChars)
  );
}

// ---------------------------------------------------------------------------
// Error hygiene — users see safe messages, never raw provider payloads
// ---------------------------------------------------------------------------

interface ProviderErrorLike {
  code?: number;
  name?: string;
  message?: string;
}

function asProviderError(e: unknown): ProviderErrorLike {
  if (typeof e === 'object' && e !== null) return e as ProviderErrorLike;
  return {};
}

/** Classifies a wallet-connection failure without exposing raw error content. */
export function classifyConnectError(e: unknown): ConnectFailureKind {
  const err = asProviderError(e);
  const message = (err.message ?? '').toLowerCase();
  const name = (err.name ?? '').toLowerCase();
  // EIP-1193: 4001 = user rejected request.
  if (err.code === 4001 || name.includes('userrejected') || message.includes('rejected')) {
    return 'rejected';
  }
  if (name.includes('timeout') || message.includes('timed out') || message.includes('timeout')) {
    return 'timeout';
  }
  if (
    name.includes('providernotfound') ||
    message.includes('provider not found') ||
    message.includes('no injected provider')
  ) {
    return 'no-wallet';
  }
  return 'unknown';
}

/** Human-readable, non-leaking message for a connection failure. */
export function connectFailureMessage(kind: ConnectFailureKind): string {
  switch (kind) {
    case 'rejected':
      return 'You rejected the connection request in your wallet. Nothing was connected, and nothing was signed.';
    case 'timeout':
      return 'The connection request timed out. Open your wallet extension and try again.';
    case 'no-wallet':
      return 'No injected wallet was detected. Install a compatible browser wallet (for example MetaMask, Rabby, or Coinbase Wallet extension) and reload.';
    case 'unknown':
      return 'The wallet connection failed. No funds are at risk from a failed connection. Try again, or check your wallet extension.';
  }
}

// ---------------------------------------------------------------------------
// Security status panel (read-only phase)
// ---------------------------------------------------------------------------

export interface SecurityStatusInput {
  connected: boolean;
  chainId?: number;
  chainSupported: boolean;
  chainName?: string;
  /** From chain-config: must be false everywhere in phase one. */
  transactionsEnabled: boolean;
  /** Local persistence opt-in; false by default. */
  persistenceEnabled: boolean;
}

export function buildSecurityStatus(input: SecurityStatusInput): SecurityCheck[] {
  const checks: SecurityCheck[] = [
    {
      id: 'custody',
      label: 'Non-custodial',
      status: 'ok',
      detail:
        'OMIKAMI WALLET never holds your keys or funds and will never ask for a seed phrase or private key. All signing happens inside your own wallet.',
    },
    {
      id: 'read-only',
      label: 'Read-only phase',
      status: input.transactionsEnabled ? 'warning' : 'ok',
      detail: input.transactionsEnabled
        ? 'Transaction features are enabled — this must not happen in phase one. Report this.'
        : 'Sending, token approvals, swaps, and message signing are disabled in this build.',
    },
    {
      id: 'analytics',
      label: 'No analytics',
      status: 'ok',
      detail: 'No analytics, tracking, or fingerprinting scripts are loaded by this application.',
    },
    {
      id: 'persistence',
      label: input.persistenceEnabled ? 'Local persistence on' : 'No stored session',
      status: input.persistenceEnabled ? 'info' : 'ok',
      detail: input.persistenceEnabled
        ? 'You enabled local persistence. Connection metadata is stored in this browser only.'
        : 'Nothing about your wallet is stored after you close this tab.',
    },
  ];

  if (input.connected) {
    checks.push({
      id: 'network',
      label: 'Network',
      status: input.chainSupported ? 'ok' : 'warning',
      detail: input.chainSupported
        ? `Connected to ${input.chainName ?? 'a supported network'}.`
        : `Your wallet is on ${input.chainName ?? 'an unsupported network'}. This build supports Ethereum Sepolia (testnet) only. OMIKAMI WALLET never switches networks for you — change it in your wallet if you intend to.`,
    });
  } else {
    checks.push({
      id: 'network',
      label: 'Network',
      status: 'info',
      detail: 'Connect a wallet to see network status. Supported now: Ethereum Sepolia (testnet).',
    });
  }

  return checks;
}

export * from './activity';

export * from './rpc';

export * from './send-preview';

export * from './allowance';
