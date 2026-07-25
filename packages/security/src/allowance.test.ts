import { describe, expect, it } from 'vitest';
import {
  classifyAllowanceRisk,
  isUnlimitedAllowance,
  summarizeApprovals,
  UNLIMITED_THRESHOLD,
  type ApprovalRecord,
} from './allowance';

const USER = '0x1111111111111111111111111111111111111111';
const USDC = '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238'; // registry (lowercase)
const UNKNOWN = '0x9999999999999999999999999999999999999999';
const SPENDER_A = '0xaaaa000000000000000000000000000000000001';
const SPENDER_B = '0xbbbb000000000000000000000000000000000002';
const MAX_UINT256 = 2n ** 256n - 1n;

function approval(over: Partial<ApprovalRecord> = {}): ApprovalRecord {
  return {
    token: USDC,
    owner: USER,
    spender: SPENDER_A,
    value: 1_000000n,
    blockNumber: 100n,
    txHash: '0xhash',
    logIndex: 0,
    ...over,
  };
}

describe('isUnlimitedAllowance', () => {
  it('flags MAX_UINT256 and half-max as unlimited', () => {
    expect(isUnlimitedAllowance(MAX_UINT256)).toBe(true);
    expect(isUnlimitedAllowance(UNLIMITED_THRESHOLD)).toBe(true);
  });
  it('treats large-but-finite (e.g. 2^96-1 Permit2 style) as NOT unlimited', () => {
    expect(isUnlimitedAllowance(2n ** 96n - 1n)).toBe(false);
    expect(isUnlimitedAllowance(1_000000n)).toBe(false);
    expect(isUnlimitedAllowance(0n)).toBe(false);
  });
});

describe('classifyAllowanceRisk', () => {
  it('zero → ok, no active allowance', () => {
    expect(classifyAllowanceRisk({ value: 0n, tokenVerified: true })).toEqual({
      status: 'ok',
      label: 'No active allowance',
      unlimited: false,
    });
  });
  it('unlimited → blocked + unlimited flag', () => {
    const r = classifyAllowanceRisk({ value: MAX_UINT256, tokenVerified: true });
    expect(r.status).toBe('blocked');
    expect(r.unlimited).toBe(true);
  });
  it('finite on verified token → info/limited', () => {
    const r = classifyAllowanceRisk({ value: 5_000000n, tokenVerified: true });
    expect(r.status).toBe('info');
    expect(r.label).toBe('Limited');
    expect(r.unlimited).toBe(false);
  });
  it('finite on unverified token → warning', () => {
    const r = classifyAllowanceRisk({ value: 5_000000n, tokenVerified: false });
    expect(r.status).toBe('warning');
    expect(r.label).toBe('Unverified token');
  });
});

describe('summarizeApprovals', () => {
  it('ignores approvals whose owner is not the user', () => {
    const out = summarizeApprovals(
      [approval({ owner: '0x2222222222222222222222222222222222222222' })],
      USER,
      [USDC],
    );
    expect(out.pairs).toHaveLength(0);
    expect(out.quarantined).toHaveLength(0);
  });

  it('dedupes a (token, spender) pair and keeps the latest block', () => {
    const out = summarizeApprovals(
      [
        approval({ blockNumber: 100n }),
        approval({ blockNumber: 250n }),
        approval({ blockNumber: 175n }),
      ],
      USER,
      [USDC],
    );
    expect(out.pairs).toHaveLength(1);
    expect(out.pairs[0]?.lastBlock).toBe(250n);
  });

  it('keeps distinct spenders separate and sorts newest-first', () => {
    const out = summarizeApprovals(
      [
        approval({ spender: SPENDER_A, blockNumber: 100n }),
        approval({ spender: SPENDER_B, blockNumber: 300n }),
      ],
      USER,
      [USDC],
    );
    expect(out.pairs.map((p) => p.spender)).toEqual([SPENDER_B, SPENDER_A]);
  });

  it('quarantines unknown-token approvals (not in registry) with a count', () => {
    const out = summarizeApprovals(
      [
        approval({ token: UNKNOWN, spender: SPENDER_A, blockNumber: 10n }),
        approval({ token: UNKNOWN, spender: SPENDER_A, blockNumber: 20n }),
        approval({ token: USDC, spender: SPENDER_B, blockNumber: 30n }),
      ],
      USER,
      [USDC],
    );
    expect(out.pairs).toHaveLength(1);
    expect(out.pairs[0]?.token).toBe(USDC);
    expect(out.quarantined).toHaveLength(1);
    expect(out.quarantined[0]?.token).toBe(UNKNOWN);
    expect(out.quarantined[0]?.approvalCount).toBe(2);
    expect(out.quarantined[0]?.lastBlock).toBe(20n);
  });

  it('is case-insensitive on addresses and lowercases output', () => {
    const out = summarizeApprovals(
      [approval({ token: USDC.toUpperCase().replace('0X', '0x'), owner: USER.toUpperCase().replace('0X', '0x') })],
      USER,
      [USDC.toUpperCase().replace('0X', '0x')],
    );
    expect(out.pairs).toHaveLength(1);
    expect(out.pairs[0]?.token).toBe(USDC);
  });
});
