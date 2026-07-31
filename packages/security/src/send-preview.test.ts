import { describe, expect, it } from 'vitest';
import { buildSendPreview, parseAmountInput, ZERO_ADDRESS } from './send-preview';
import type { SendPreviewAsset } from './send-preview';

const NATIVE: SendPreviewAsset = {
  kind: 'native',
  symbol: 'SepoliaETH',
  decimals: 18,
  verified: true,
};

// USDC on Sepolia (from the reviewed registry).
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const ERC20: SendPreviewAsset = {
  kind: 'erc20',
  symbol: 'USDC',
  decimals: 6,
  contractAddress: USDC,
  verified: true,
};

const USER = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';

function base(over: Partial<Parameters<typeof buildSendPreview>[0]> = {}) {
  return buildSendPreview({
    fromAddress: USER,
    recipientInput: OTHER,
    amountInput: '1',
    asset: NATIVE,
    transactionsEnabled: false,
    ...over,
  });
}

function check(preview: ReturnType<typeof buildSendPreview>, id: string) {
  return preview.checks.find((c) => c.id === id);
}

describe('parseAmountInput', () => {
  it('rejects empty and non-numeric input', () => {
    expect(parseAmountInput('', 18).reason).toBe('empty');
    expect(parseAmountInput('   ', 18).reason).toBe('empty');
    expect(parseAmountInput('.', 18).reason).toBe('format');
    expect(parseAmountInput('1.2.3', 18).reason).toBe('format');
    expect(parseAmountInput('-1', 18).reason).toBe('format');
    expect(parseAmountInput('1e3', 18).reason).toBe('format');
    expect(parseAmountInput('1,000', 18).reason).toBe('format');
    expect(parseAmountInput('abc', 18).reason).toBe('format');
  });

  it('rejects zero in every spelling', () => {
    expect(parseAmountInput('0', 18).reason).toBe('zero');
    expect(parseAmountInput('0.0', 18).reason).toBe('zero');
    expect(parseAmountInput('.0', 18).reason).toBe('zero');
    expect(parseAmountInput('00', 18).reason).toBe('zero');
  });

  it('rejects more fractional digits than the asset supports', () => {
    expect(parseAmountInput('1.1234567', 6).reason).toBe('too-many-decimals');
    expect(parseAmountInput('1.123456', 6).valid).toBe(true);
  });

  it('parses to exact base units without floating point', () => {
    expect(parseAmountInput('1', 18).value).toBe(1_000000000000000000n);
    expect(parseAmountInput('0.05', 18).value).toBe(50000000000000000n);
    expect(parseAmountInput('1.5', 6).value).toBe(1_500000n);
    expect(parseAmountInput('.5', 6).value).toBe(500000n);
    // A value that is not representable in float64 must survive exactly.
    expect(parseAmountInput('0.123456789012345678', 18).value).toBe(123456789012345678n);
  });

  it('handles long/adversarial input quickly (no ReDoS) and rejects it', () => {
    // The old ambiguous regex backtracked super-linearly here; the fixed one
    // is linear. Assert it returns fast and rejects a long non-numeric tail.
    const evil = '9'.repeat(50000) + '!';
    const start = Date.now();
    expect(parseAmountInput(evil, 18).reason).toBe('format');
    expect(Date.now() - start).toBeLessThan(100);
    // A long VALID integer still parses.
    expect(parseAmountInput('1'.repeat(30), 0).value).toBe(BigInt('1'.repeat(30)));
  });
});

describe('buildSendPreview — invariants', () => {
  it('never reports signing as available', () => {
    expect(base().signingAvailable).toBe(false);
    expect(base({ transactionsEnabled: true }).signingAvailable).toBe(false);
  });

  it('flags a build that unexpectedly enables transactions as blocked', () => {
    const p = base({ transactionsEnabled: true });
    expect(check(p, 'signing')?.status).toBe('blocked');
    expect(p.wouldBlock).toBe(true);
  });

  it('is a pure function (identical inputs → identical output)', () => {
    expect(base()).toEqual(base());
  });

  it('a clean native transfer produces no blocking checks', () => {
    const p = base({ availableBalance: 2_000000000000000000n });
    expect(p.wouldBlock).toBe(false);
    expect(check(p, 'recipient')?.status).toBe('ok');
    expect(check(p, 'amount')?.status).toBe('ok');
  });
});

describe('buildSendPreview — recipient', () => {
  it('asks for input when empty, without blocking', () => {
    const p = base({ recipientInput: '' });
    expect(check(p, 'recipient')?.status).toBe('info');
    expect(p.recipient.valid).toBe(false);
    // wouldBlock is true (invalid recipient) but there is no red "blocked" check.
    expect(check(p, 'recipient')?.status).not.toBe('blocked');
    expect(p.wouldBlock).toBe(true);
  });

  it('blocks a malformed address', () => {
    const p = base({ recipientInput: '0x1234' });
    expect(check(p, 'recipient')?.status).toBe('blocked');
    expect(p.wouldBlock).toBe(true);
  });

  it('blocks a mixed-case address that fails EIP-55', () => {
    // A valid address with one case flip fails the checksum.
    const bad = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7239'; // last digit changed keeps hex but breaks checksum context
    const p = base({ recipientInput: '0xAbC1230000000000000000000000000000000000' });
    expect(check(p, 'recipient')?.status).toBe('blocked');
    expect(check(p, 'recipient')?.label).toMatch(/checksum/i);
    expect(bad).toBeDefined();
  });

  it('blocks the zero address (burn)', () => {
    const p = base({ recipientInput: ZERO_ADDRESS });
    expect(check(p, 'recipient')?.label).toMatch(/zero address/i);
    expect(check(p, 'recipient')?.status).toBe('blocked');
  });

  it('blocks sending a token to its own contract', () => {
    const p = base({ recipientInput: USDC, asset: ERC20 });
    expect(check(p, 'recipient')?.label).toMatch(/contract/i);
    expect(check(p, 'recipient')?.status).toBe('blocked');
  });

  it('warns on a self-send', () => {
    const p = base({ recipientInput: USER });
    expect(check(p, 'recipient')?.label).toMatch(/your own/i);
    expect(check(p, 'recipient')?.status).toBe('warning');
    // A self-send is a warning, not a hard block.
    expect(p.wouldBlock).toBe(false);
  });

  it('warns on an address-poisoning lookalike', () => {
    const real = '0xABCD567890000000000000000000000000001234';
    const poisoned = '0xABCD999990000000000000000000000000001234'; // same 6-prefix + 4-suffix
    const p = base({ recipientInput: poisoned, knownAddresses: [real] });
    expect(check(p, 'recipient')?.label).toMatch(/poison/i);
    expect(check(p, 'recipient')?.status).toBe('warning');
  });
});

describe('buildSendPreview — amount', () => {
  it('blocks an over-balance amount', () => {
    const p = base({ amountInput: '5', availableBalance: 1_000000000000000000n });
    expect(check(p, 'amount')?.label).toMatch(/exceeds/i);
    expect(check(p, 'amount')?.status).toBe('blocked');
    expect(p.wouldBlock).toBe(true);
  });

  it('warns on a zero amount', () => {
    const p = base({ amountInput: '0' });
    expect(check(p, 'amount')?.status).toBe('warning');
  });

  it('does not check balance when it is unknown', () => {
    const p = base({ amountInput: '999999' });
    expect(check(p, 'amount')?.status).toBe('ok');
    expect(check(p, 'amount')?.detail).toMatch(/balance is unknown/i);
  });
});

describe('buildSendPreview — asset trust', () => {
  it('warns when an ERC-20 is not in the registry', () => {
    const p = base({
      recipientInput: OTHER,
      asset: { ...ERC20, verified: false },
    });
    expect(check(p, 'asset')?.status).toBe('warning');
  });

  it('marks a native asset as ok', () => {
    expect(check(base(), 'asset')?.status).toBe('ok');
  });
});
