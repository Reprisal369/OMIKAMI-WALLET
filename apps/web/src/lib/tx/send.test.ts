/**
 * STATUS: REVIEW — security tests for the gated wallet-write entry point.
 *
 * These use a MOCKED wallet (no real provider, no real signature, no network).
 * The central property: while transactions are disabled — the only state in this
 * build — a send attempt makes ZERO calls to the wallet and raises
 * TransactionsDisabledError. The "gate ON" cases exist only to prove the wiring
 * is correct; `transactionsEnabled` is false everywhere in shipped code.
 */
import { describe, expect, it, vi } from 'vitest';
import { getAddress } from 'viem';
import { sendGatedTransaction, type WalletSend } from './send';
import { TransactionsDisabledError } from '@omikami/security';
import type { TxRequest } from '@omikami/types';

const REQUEST: TxRequest = {
  to: getAddress('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'),
  value: 1n,
  data: '0x',
  chainId: 11155111,
};
// 32-byte hash assembled at runtime — no 0x+64-hex literal in source.
const HASH = ('0x' + 'ab'.repeat(32)) as `0x${string}`;

function mockWallet(impl?: WalletSend['sendTransaction']): WalletSend & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    sendTransaction: vi.fn(async (args: Parameters<WalletSend['sendTransaction']>[0]) => {
      calls.push(args);
      return impl ? impl(args) : HASH;
    }),
  };
}

describe('sendGatedTransaction — gate OFF (the only state in this build)', () => {
  it('throws TransactionsDisabledError and makes ZERO wallet calls', async () => {
    const wallet = mockWallet();
    await expect(
      sendGatedTransaction({ wallet, request: REQUEST, transactionsEnabled: false }),
    ).rejects.toBeInstanceOf(TransactionsDisabledError);
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
    expect(wallet.calls).toHaveLength(0);
  });

  it('refuses regardless of the request contents (gate is checked first)', async () => {
    const wallet = mockWallet();
    const erc20 = { ...REQUEST, to: getAddress('0x1c7d4b196cb0c7b01d743fbc6116a902379c7238'), value: 0n };
    await expect(
      sendGatedTransaction({ wallet, request: erc20, transactionsEnabled: false }),
    ).rejects.toBeInstanceOf(TransactionsDisabledError);
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
  });
});

describe('sendGatedTransaction — gate ON (wiring proof only; never reached in this build)', () => {
  it('hands the EXACT request to the wallet exactly once and returns the hash', async () => {
    const wallet = mockWallet();
    const hash = await sendGatedTransaction({ wallet, request: REQUEST, transactionsEnabled: true });
    expect(hash).toBe(HASH);
    expect(wallet.sendTransaction).toHaveBeenCalledTimes(1);
    expect(wallet.sendTransaction).toHaveBeenCalledWith({
      to: REQUEST.to,
      value: REQUEST.value,
      data: REQUEST.data,
      chainId: REQUEST.chainId,
    });
  });

  it('propagates a rejected wallet request and never retries', async () => {
    const err = Object.assign(new Error('User rejected'), { code: 4001 });
    const wallet = mockWallet(async () => {
      throw err;
    });
    await expect(
      sendGatedTransaction({ wallet, request: REQUEST, transactionsEnabled: true }),
    ).rejects.toBe(err);
    expect(wallet.sendTransaction).toHaveBeenCalledTimes(1);
  });

  it('does not mutate the request it was handed', async () => {
    const wallet = mockWallet();
    const frozen = Object.freeze({ ...REQUEST });
    await sendGatedTransaction({ wallet, request: frozen, transactionsEnabled: true });
    expect(frozen).toEqual(REQUEST);
  });
});
