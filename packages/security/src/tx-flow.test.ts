import { describe, expect, it } from 'vitest';
import { getAddress } from 'viem';
import {
  classifyTxError,
  txErrorMessage,
  checkTransactionNetwork,
  buildVerifiedSend,
  assertTransactionsEnabled,
  TransactionsDisabledError,
} from './tx-flow';
import { TxDecodeError } from './tx-build';
import type { TxErrorKind } from '@omikami/types';

const RECIPIENT = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed';
const USDC = '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238';
const CHAIN = 11155111;

describe('classifyTxError — safe, non-leaking categories', () => {
  it('maps EIP-1193 4001 to user-rejected', () => {
    expect(classifyTxError({ code: 4001, message: 'User denied transaction signature' })).toBe(
      'user-rejected',
    );
    expect(classifyTxError({ name: 'UserRejectedRequestError' })).toBe('user-rejected');
  });

  it('maps insufficient funds', () => {
    expect(classifyTxError({ message: 'insufficient funds for gas * price + value' })).toBe(
      'insufficient-funds',
    );
  });

  it('maps a reverting gas estimate', () => {
    expect(classifyTxError({ message: 'execution reverted: ERC20: transfer amount exceeds balance' })).toBe(
      'gas-estimation-failed',
    );
    expect(classifyTxError({ message: 'gas required exceeds allowance' })).toBe('gas-estimation-failed');
  });

  it('maps wrong-network signals', () => {
    expect(classifyTxError({ message: 'chain mismatch: wallet is on a different chain id' })).toBe(
      'wrong-network',
    );
  });

  it('maps nonce / replacement issues', () => {
    expect(classifyTxError({ message: 'nonce too low' })).toBe('nonce-replacement');
    expect(classifyTxError({ message: 'replacement transaction underpriced' })).toBe('nonce-replacement');
  });

  it('maps decode and broadcast failures', () => {
    expect(classifyTxError({ message: 'could not decode calldata' })).toBe('decode-failed');
    expect(classifyTxError({ message: 'failed to send raw transaction' })).toBe('broadcast-failed');
  });

  it('falls back to unknown and never throws on odd input', () => {
    expect(classifyTxError({ message: 'something weird happened' })).toBe('unknown');
    expect(classifyTxError(null)).toBe('unknown');
    expect(classifyTxError('a string')).toBe('unknown');
    expect(classifyTxError(undefined)).toBe('unknown');
  });
});

describe('txErrorMessage — fixed, non-leaking copy', () => {
  const kinds: TxErrorKind[] = [
    'user-rejected',
    'insufficient-funds',
    'gas-estimation-failed',
    'wrong-network',
    'nonce-replacement',
    'decode-failed',
    'broadcast-failed',
    'unknown',
  ];

  it('returns a non-empty message for every kind', () => {
    for (const kind of kinds) {
      const msg = txErrorMessage(kind);
      expect(msg.length).toBeGreaterThan(0);
      // Never implies funds moved on a failure.
      expect(msg.toLowerCase()).not.toContain('raw');
    }
  });

  it('is reassuring and action-oriented for a rejection', () => {
    expect(txErrorMessage('user-rejected')).toMatch(/nothing was signed/i);
  });

  it('refuses to auto-switch networks in its wording', () => {
    expect(txErrorMessage('wrong-network')).toMatch(/never switches networks/i);
  });
});

describe('checkTransactionNetwork — wrong-network gate (P5)', () => {
  it('passes only when the wallet is on the intended chain', () => {
    expect(checkTransactionNetwork(CHAIN, CHAIN)).toEqual({ ok: true });
  });

  it('blocks a mismatched chain', () => {
    expect(checkTransactionNetwork(CHAIN, 1)).toEqual({ ok: false, kind: 'wrong-network' });
  });

  it('blocks an unknown wallet chain (fail safe)', () => {
    expect(checkTransactionNetwork(CHAIN, undefined)).toEqual({ ok: false, kind: 'wrong-network' });
  });
});

describe('buildVerifiedSend — request plus the preview it decodes to', () => {
  it('native', () => {
    const { request, shown } = buildVerifiedSend({
      kind: 'native',
      to: RECIPIENT,
      amount: 10n ** 18n,
      chainId: CHAIN,
    });
    expect(request).toEqual({
      to: getAddress(RECIPIENT),
      value: 10n ** 18n,
      data: '0x',
      chainId: CHAIN,
    });
    expect(shown).toEqual({
      kind: 'native',
      recipient: getAddress(RECIPIENT),
      amount: 10n ** 18n,
      chainId: CHAIN,
    });
  });

  it('erc20', () => {
    const { request, shown } = buildVerifiedSend({
      kind: 'erc20',
      to: RECIPIENT,
      amount: 1_000_000n,
      chainId: CHAIN,
      tokenAddress: USDC,
    });
    expect(request.to).toBe(getAddress(USDC));
    expect(request.value).toBe(0n);
    expect(shown).toEqual({
      kind: 'erc20',
      recipient: getAddress(RECIPIENT),
      amount: 1_000_000n,
      chainId: CHAIN,
      tokenAddress: getAddress(USDC),
    });
  });

  it('rejects invalid input instead of returning an untrustworthy request', () => {
    expect(() => buildVerifiedSend({ kind: 'native', to: RECIPIENT, amount: 0n, chainId: CHAIN })).toThrow(
      TxDecodeError,
    );
    expect(() =>
      buildVerifiedSend({ kind: 'erc20', to: RECIPIENT, amount: 1n, chainId: CHAIN }),
    ).toThrow(TxDecodeError);
  });
});

describe('assertTransactionsEnabled — the master write gate', () => {
  it('throws when transactions are disabled (the only state in this build)', () => {
    expect(() => assertTransactionsEnabled(false)).toThrow(TransactionsDisabledError);
  });

  it('permits only when transactions are explicitly enabled', () => {
    expect(() => assertTransactionsEnabled(true)).not.toThrow();
  });
});
