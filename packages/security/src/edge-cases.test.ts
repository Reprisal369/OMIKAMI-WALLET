/**
 * OMIKAMI SHIELD — additional edge-case coverage for the pure security
 * primitives. Test-only; no product code. Targets branches and boundaries the
 * per-module suites don't hit: address-validation casing, poisoning
 * partial-match negatives, connect-error message routing, security-status
 * variants, allowance-risk precedence, and quarantine scoping.
 */
import { describe, expect, it } from 'vitest';
import {
  buildSecurityStatus,
  classifyConnectError,
  emphasizeAddress,
  isLookalikeAddress,
  validateAddress,
} from './index';
import { classifyAllowanceRisk, summarizeApprovals, type ApprovalRecord } from './allowance';
import { summarizeTransfers, type TransferRecord } from './activity';

const EIP55 = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';

describe('validateAddress — casing branches', () => {
  it('accepts all-UPPERCASE hex and returns the checksummed form', () => {
    const upper = '0x' + EIP55.slice(2).toUpperCase();
    const r = validateAddress(upper);
    expect(r.valid).toBe(true);
    expect(r.checksummed).toBe(EIP55);
  });

  it('is a pure function (identical input -> identical output)', () => {
    expect(validateAddress(EIP55)).toEqual(validateAddress(EIP55));
  });
});

describe('emphasizeAddress — length boundary', () => {
  it('returns the whole string as start when length == startChars + endChars', () => {
    const s = '0x12345678'; // length 10 == 6 + 4
    expect(emphasizeAddress(s, 6, 4)).toEqual({ start: s, middle: '', end: '' });
  });

  it('splits (non-empty middle) one char past the boundary, losing nothing', () => {
    const s = '0x123456789'; // length 11 > 10
    const r = emphasizeAddress(s, 6, 4);
    expect(r.middle).not.toBe('');
    expect(r.start + r.middle + r.end).toBe(s);
  });
});

describe('isLookalikeAddress — requires BOTH ends to match', () => {
  const A = '0xabcd' + '0'.repeat(32) + '1234';
  it('false when only the prefix matches', () => {
    const b = '0xabcd' + '0'.repeat(32) + '9999';
    expect(isLookalikeAddress(A, b, 6, 4)).toBe(false);
  });
  it('false when only the suffix matches', () => {
    const b = '0x9999' + '0'.repeat(32) + '1234';
    expect(isLookalikeAddress(A, b, 6, 4)).toBe(false);
  });
  it('false for different-length inputs', () => {
    expect(isLookalikeAddress(A, A + '00', 6, 4)).toBe(false);
  });
  it('false for non-0x inputs', () => {
    expect(isLookalikeAddress('abcXefghij', 'abcYefghij', 6, 4)).toBe(false);
  });
});

describe('classifyConnectError — message/name routing', () => {
  it('routes "no injected provider" / "provider not found" to no-wallet', () => {
    expect(classifyConnectError({ message: 'No injected provider found' })).toBe('no-wallet');
    expect(classifyConnectError({ message: 'provider not found' })).toBe('no-wallet');
  });
  it('routes a TimeoutError name to timeout', () => {
    expect(classifyConnectError({ name: 'TimeoutError' })).toBe('timeout');
  });
});

describe('buildSecurityStatus — variants', () => {
  const base = {
    connected: false,
    chainSupported: false,
    transactionsEnabled: false,
    persistenceEnabled: false,
  };
  it('marks persistence as info when enabled', () => {
    const p = buildSecurityStatus({ ...base, persistenceEnabled: true }).find(
      (c) => c.id === 'persistence',
    );
    expect(p?.status).toBe('info');
    expect(p?.label).toMatch(/persistence on/i);
  });
  it('shows network as info (not warning) when disconnected', () => {
    expect(buildSecurityStatus(base).find((c) => c.id === 'network')?.status).toBe('info');
  });
  it('always reports no-analytics as ok', () => {
    expect(buildSecurityStatus(base).find((c) => c.id === 'analytics')?.status).toBe('ok');
  });
});

describe('classifyAllowanceRisk — precedence', () => {
  it('zero wins over unverified (-> ok, no active allowance)', () => {
    expect(classifyAllowanceRisk({ value: 0n, tokenVerified: false })).toEqual({
      status: 'ok',
      label: 'No active allowance',
      unlimited: false,
    });
  });
  it('unlimited wins over unverified (-> blocked, unlimited)', () => {
    const r = classifyAllowanceRisk({ value: 2n ** 255n, tokenVerified: false });
    expect(r.status).toBe('blocked');
    expect(r.unlimited).toBe(true);
  });
});

describe('summarizeApprovals — quarantine scoping', () => {
  const USER = '0x1111111111111111111111111111111111111111';
  const UNKNOWN = '0x9999999999999999999999999999999999999999';
  const S1 = '0xaaaa000000000000000000000000000000000001';
  const S2 = '0xbbbb000000000000000000000000000000000002';
  function ap(over: Partial<ApprovalRecord> = {}): ApprovalRecord {
    return {
      token: UNKNOWN,
      owner: USER,
      spender: S1,
      value: 1n,
      blockNumber: 10n,
      txHash: '0x',
      logIndex: 0,
      ...over,
    };
  }
  it('keeps distinct spenders on the same unknown token as separate quarantine entries', () => {
    const out = summarizeApprovals([ap({ spender: S1 }), ap({ spender: S2 })], USER, []);
    expect(out.pairs).toHaveLength(0);
    expect(out.quarantined).toHaveLength(2);
  });
  it('returns empty structures for empty input', () => {
    expect(summarizeApprovals([], USER, [])).toEqual({ pairs: [], quarantined: [] });
  });
});

describe('summarizeTransfers — quarantine scoped to user-involving transfers', () => {
  const USER = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
  const OTHER = '0x0000000000000000000000000000000000000001';
  const UNKNOWN = '0x00000000000000000000000000000000000000AA';
  function tr(over: Partial<TransferRecord> = {}): TransferRecord {
    return {
      token: UNKNOWN,
      from: OTHER,
      to: OTHER,
      value: 1n,
      blockNumber: 5n,
      txHash: '0xz',
      logIndex: 0,
      ...over,
    };
  }
  it('does NOT quarantine an unknown-token transfer that does not involve the user', () => {
    const s = summarizeTransfers([tr()], USER, []);
    expect(s.items).toHaveLength(0);
    expect(s.quarantined).toHaveLength(0);
  });
  it('quarantines an unknown-token transfer that DOES involve the user', () => {
    const s = summarizeTransfers([tr({ to: USER })], USER, []);
    expect(s.items).toHaveLength(1);
    expect(s.quarantined).toHaveLength(1);
    expect(s.items[0]?.registered).toBe(false);
  });
});
