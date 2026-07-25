import { describe, expect, it } from 'vitest';
import { VERIFIED_TOKENS, formatTokenAmount, sanitizeTokenText, tokenEntrySchema } from './index';

// EIP-55 spec test vector, not a production token address.
const CHECKSUMMED = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';

const valid = {
  chainId: 11155111,
  address: CHECKSUMMED,
  symbol: 'TEST',
  name: 'Test Token',
  decimals: 18,
  status: 'unverified' as const,
  evidence: 'unit-test fixture',
};

describe('tokenEntrySchema', () => {
  it('accepts a well-formed entry with a checksummed address', () => {
    expect(() => tokenEntrySchema.parse(valid)).not.toThrow();
  });

  it('rejects non-checksummed (lowercase) addresses', () => {
    expect(() => tokenEntrySchema.parse({ ...valid, address: CHECKSUMMED.toLowerCase() })).toThrow();
  });

  it('rejects malformed addresses and missing evidence', () => {
    expect(() => tokenEntrySchema.parse({ ...valid, address: '0x123' })).toThrow();
    expect(() => tokenEntrySchema.parse({ ...valid, evidence: '' })).toThrow();
  });

  it('rejects out-of-range decimals and oversized metadata', () => {
    expect(() => tokenEntrySchema.parse({ ...valid, decimals: -1 })).toThrow();
    expect(() => tokenEntrySchema.parse({ ...valid, decimals: 256 })).toThrow();
    expect(() => tokenEntrySchema.parse({ ...valid, symbol: 'X'.repeat(21) })).toThrow();
  });

  it('registry invariant: every shipped entry is schema-valid, Sepolia-only, with real evidence', () => {
    for (const t of VERIFIED_TOKENS) {
      expect(() => tokenEntrySchema.parse(t)).not.toThrow();
      expect(t.chainId).toBe(11155111);
      expect(t.evidence.length).toBeGreaterThan(10);
    }
  });
});

describe('formatTokenAmount', () => {
  it('formats whole and fractional values without float math', () => {
    expect(formatTokenAmount(50000000000000000n, 18)).toBe('0.05');
    expect(formatTokenAmount(1000000n, 6)).toBe('1');
    expect(formatTokenAmount(1500000n, 6)).toBe('1.5');
    expect(formatTokenAmount(0n, 6)).toBe('0');
  });

  it('marks truncation explicitly instead of silently rounding', () => {
    expect(formatTokenAmount(1234567890123456789n, 18)).toBe('≈ 1.234567');
  });

  it('handles very large balances', () => {
    expect(formatTokenAmount(123456789000000n, 6)).toBe('123456789');
  });
});

describe('sanitizeTokenText', () => {
  it('strips control characters and angle brackets', () => {
    expect(sanitizeTokenText('USDC<script>x')).toBe('USDCscriptx');
  });

  it('collapses whitespace and caps length with an ellipsis', () => {
    expect(sanitizeTokenText('  A   B  ')).toBe('A B');
    expect(sanitizeTokenText('X'.repeat(40))).toBe('X'.repeat(32) + '…');
  });
});
