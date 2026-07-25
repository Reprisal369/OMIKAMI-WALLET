import { describe, expect, it } from 'vitest';
import {
  buildSecurityStatus,
  classifyConnectError,
  connectFailureMessage,
  emphasizeAddress,
  isLookalikeAddress,
  validateAddress,
} from './index';

// EIP-55 specification test vector (from the EIP-55 document itself; not a
// production contract address).
const EIP55 = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
const ZERO = '0x0000000000000000000000000000000000000000';

describe('validateAddress', () => {
  it('accepts a correctly checksummed address', () => {
    const r = validateAddress(EIP55);
    expect(r.valid).toBe(true);
    expect(r.checksummed).toBe(EIP55);
  });

  it('accepts all-lowercase input and returns the checksummed form', () => {
    const r = validateAddress(EIP55.toLowerCase());
    expect(r.valid).toBe(true);
    expect(r.checksummed).toBe(EIP55);
  });

  it('rejects mixed-case input with a wrong checksum', () => {
    // Flip the case of one alphabetic character to corrupt the checksum.
    const corrupted = EIP55.replace('aA', 'Aa');
    expect(corrupted).not.toBe(EIP55);
    const r = validateAddress(corrupted);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('checksum');
  });

  it('rejects empty, malformed, and non-hex input', () => {
    expect(validateAddress('').reason).toBe('empty');
    expect(validateAddress('   ').reason).toBe('empty');
    expect(validateAddress('0x123').reason).toBe('format');
    expect(validateAddress('not-an-address').reason).toBe('format');
    expect(validateAddress(`${ZERO}00`).reason).toBe('format');
  });

  it('trims surrounding whitespace', () => {
    const r = validateAddress(`  ${EIP55}  `);
    expect(r.valid).toBe(true);
  });
});

describe('emphasizeAddress', () => {
  it('splits start, middle, and end without losing characters', () => {
    const { start, middle, end } = emphasizeAddress(EIP55, 6, 4);
    expect(start).toBe('0x5aAe');
    expect(end).toBe('eAed');
    expect(start + middle + end).toBe(EIP55);
  });

  it('never hides the middle for short strings', () => {
    const r = emphasizeAddress('0xabc', 6, 4);
    expect(r.start + r.middle + r.end).toBe('0xabc');
  });
});

describe('isLookalikeAddress', () => {
  it('flags different addresses sharing prefix and suffix', () => {
    const a = '0xab12cd0000000000000000000000000000009f8e';
    const b = '0xab12cd1111111111111111111111111111119f8e';
    expect(isLookalikeAddress(a, b, 8, 4)).toBe(true);
  });

  it('is case-insensitive', () => {
    const a = '0xAB12CD0000000000000000000000000000009F8E';
    const b = '0xab12cd1111111111111111111111111111119f8e';
    expect(isLookalikeAddress(a, b, 8, 4)).toBe(true);
  });

  it('does not flag an address against itself', () => {
    expect(isLookalikeAddress(EIP55, EIP55)).toBe(false);
    expect(isLookalikeAddress(EIP55, EIP55.toLowerCase())).toBe(false);
  });

  it('does not flag clearly different addresses', () => {
    expect(isLookalikeAddress(EIP55, ZERO)).toBe(false);
  });
});

describe('classifyConnectError', () => {
  it('classifies EIP-1193 user rejection (code 4001)', () => {
    expect(classifyConnectError({ code: 4001, message: 'User rejected the request.' })).toBe(
      'rejected',
    );
    expect(classifyConnectError({ name: 'UserRejectedRequestError' })).toBe('rejected');
  });

  it('classifies timeouts', () => {
    expect(classifyConnectError({ message: 'Request timed out' })).toBe('timeout');
  });

  it('classifies missing providers', () => {
    expect(classifyConnectError({ name: 'ProviderNotFoundError' })).toBe('no-wallet');
  });

  it('falls back to unknown without leaking details', () => {
    expect(classifyConnectError(new Error('secret rpc url http://x'))).toBe('unknown');
    expect(classifyConnectError(undefined)).toBe('unknown');
  });

  it('produces a safe message for every kind', () => {
    for (const kind of ['rejected', 'timeout', 'no-wallet', 'unknown'] as const) {
      const msg = connectFailureMessage(kind);
      expect(msg.length).toBeGreaterThan(10);
      expect(msg).not.toContain('http');
    }
  });
});

describe('buildSecurityStatus', () => {
  const base = {
    connected: false,
    chainSupported: false,
    transactionsEnabled: false,
    persistenceEnabled: false,
  };

  it('always includes the non-custodial guarantee', () => {
    const checks = buildSecurityStatus(base);
    const custody = checks.find((c) => c.id === 'custody');
    expect(custody?.status).toBe('ok');
    expect(custody?.detail).toContain('seed phrase');
  });

  it('reports read-only mode as ok when transactions are disabled', () => {
    const readOnly = buildSecurityStatus(base).find((c) => c.id === 'read-only');
    expect(readOnly?.status).toBe('ok');
  });

  it('escalates if transactions are ever enabled in phase one', () => {
    const readOnly = buildSecurityStatus({ ...base, transactionsEnabled: true }).find(
      (c) => c.id === 'read-only',
    );
    expect(readOnly?.status).toBe('warning');
  });

  it('warns on unsupported networks when connected', () => {
    const network = buildSecurityStatus({
      ...base,
      connected: true,
      chainSupported: false,
      chainName: 'Ethereum',
    }).find((c) => c.id === 'network');
    expect(network?.status).toBe('warning');
    expect(network?.detail).toContain('never switches networks');
  });

  it('shows ok on the supported network', () => {
    const network = buildSecurityStatus({
      ...base,
      connected: true,
      chainSupported: true,
      chainName: 'Sepolia',
    }).find((c) => c.id === 'network');
    expect(network?.status).toBe('ok');
  });
});
