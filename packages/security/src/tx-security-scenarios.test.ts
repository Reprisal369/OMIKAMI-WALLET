/**
 * STATUS: REVIEW — explicit adversarial/edge security scenarios for the
 * (disabled) transaction flow. Exercised against the PURE modules only: no
 * wallet, no provider, no network, no signature. These document the safety
 * properties a reviewer should confirm before the wallet hook is connected.
 */
import { describe, expect, it } from 'vitest';
import { getAddress } from 'viem';
import {
  buildTxFlow,
  requestSignature,
  onSigned,
  onReceipt,
  resetTxFlow,
  isTerminalTxFlow,
} from './tx-state-machine';
import { assertShownEqualsSigned, TxDecodeError } from './tx-build';
import { buildVerifiedSend } from './tx-flow';

const A = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed';
const B = '0x00000000000000000000000000000000deadbeef';
const SEPOLIA = 11155111;
const HASH = ('0x' + 'cd'.repeat(32)) as `0x${string}`;

function previewing() {
  const flow = buildTxFlow({ kind: 'native', to: A, amount: 1n, chainId: SEPOLIA });
  expect(flow.status).toBe('previewing');
  return flow;
}

describe('SECURITY: network change during preparation (P5)', () => {
  it('a wallet that switched networks between build and sign is blocked', () => {
    // Intended Sepolia, but the wallet is now on mainnet (1).
    expect(requestSignature(previewing(), 1)).toMatchObject({
      status: 'failed',
      error: 'wrong-network',
    });
  });

  it('an unknown/disconnected wallet network fails closed', () => {
    expect(requestSignature(previewing(), undefined)).toMatchObject({
      status: 'failed',
      error: 'wrong-network',
    });
  });
});

describe('SECURITY: stale / mismatched preview is rejected (P3)', () => {
  it('a preview whose amount no longer matches the request is blocked', () => {
    const { request } = buildVerifiedSend({ kind: 'native', to: A, amount: 1_000n, chainId: SEPOLIA });
    const stalePreview = { kind: 'native' as const, recipient: getAddress(A), amount: 999n, chainId: SEPOLIA };
    expect(() => assertShownEqualsSigned(request, stalePreview)).toThrow(TxDecodeError);
  });

  it('a preview whose recipient no longer matches the request is blocked', () => {
    const { request, shown } = buildVerifiedSend({ kind: 'native', to: A, amount: 1n, chainId: SEPOLIA });
    expect(() => assertShownEqualsSigned(request, { ...shown, recipient: getAddress(B) })).toThrow(
      TxDecodeError,
    );
  });
});

describe('SECURITY: duplicate submission prevention', () => {
  it('a signed tx cannot be submitted twice; a second signature callback is a no-op', () => {
    const pending = onSigned(requestSignature(previewing(), SEPOLIA), HASH);
    expect(pending.status).toBe('pending');
    const again = onSigned(pending, ('0x' + 'ef'.repeat(32)) as `0x${string}`);
    expect(again).toBe(pending); // unchanged — no second submission
    expect(again.hash).toBe(HASH); // original hash preserved
  });

  it('a signature cannot be re-requested once pending', () => {
    const pending = onSigned(requestSignature(previewing(), SEPOLIA), HASH);
    expect(requestSignature(pending, SEPOLIA)).toBe(pending);
  });

  it('a terminal (confirmed) flow accepts no further transitions', () => {
    const confirmed = onReceipt(onSigned(requestSignature(previewing(), SEPOLIA), HASH), 'confirmed');
    expect(isTerminalTxFlow(confirmed)).toBe(true);
    expect(onSigned(confirmed, HASH)).toBe(confirmed);
    expect(requestSignature(confirmed, SEPOLIA)).toBe(confirmed);
    expect(onReceipt(confirmed, 'failed')).toBe(confirmed);
  });
});

describe('SECURITY: account change during preparation', () => {
  it('the request embeds no sender; an account change is handled by rebuilding from idle', () => {
    const flow = previewing();
    // The request carries only to/value/data/chainId — the wallet is the sole
    // source of the sender, so an account switch cannot silently redirect funds.
    expect(flow.request).not.toHaveProperty('from');
    expect(Object.keys(flow.request ?? {}).sort()).toEqual(['chainId', 'data', 'to', 'value']);
    // On an account change the UI rebuilds from a clean slate.
    expect(resetTxFlow()).toEqual({ status: 'idle' });
  });
});
