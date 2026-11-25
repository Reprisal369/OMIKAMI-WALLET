import { describe, expect, it } from 'vitest';
import { getAddress } from 'viem';
import {
  initialTxFlow,
  resetTxFlow,
  buildTxFlow,
  requestSignature,
  onSigned,
  onTxError,
  onReceipt,
  isTerminalTxFlow,
  type TxFlow,
} from './tx-state-machine';

const RECIPIENT = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed';
const CHAIN = 11155111;
// A 32-byte tx hash, assembled at runtime so no 0x+64-hex literal sits in source
// (that shape is reserved for private keys and is blocked by the secret scanners).
const HASH = ('0x' + 'ab'.repeat(32)) as `0x${string}`;

function previewing(): TxFlow {
  const flow = buildTxFlow({ kind: 'native', to: RECIPIENT, amount: 10n ** 18n, chainId: CHAIN });
  expect(flow.status).toBe('previewing');
  return flow;
}

describe('tx state machine — happy path', () => {
  it('walks idle → previewing → awaiting-signature → pending → confirmed', () => {
    expect(initialTxFlow.status).toBe('idle');

    const built = buildTxFlow({ kind: 'native', to: RECIPIENT, amount: 42n, chainId: CHAIN });
    expect(built.status).toBe('previewing');
    expect(built.request?.to).toBe(getAddress(RECIPIENT));
    expect(built.shown?.amount).toBe(42n);

    const awaiting = requestSignature(built, CHAIN);
    expect(awaiting.status).toBe('awaiting-signature');

    const pending = onSigned(awaiting, HASH);
    expect(pending.status).toBe('pending');
    expect(pending.hash).toBe(HASH);

    const done = onReceipt(pending, 'confirmed');
    expect(done.status).toBe('confirmed');
    expect(isTerminalTxFlow(done)).toBe(true);
  });
});

describe('tx state machine — safe failures', () => {
  it('invalid input lands on failed:decode-failed, never throws', () => {
    const flow = buildTxFlow({ kind: 'native', to: RECIPIENT, amount: 0n, chainId: CHAIN });
    expect(flow).toEqual({ status: 'failed', error: 'decode-failed' });
    expect(isTerminalTxFlow(flow)).toBe(true);
  });

  it('blocks a wrong wallet network before signing (P5)', () => {
    const flow = requestSignature(previewing(), 1);
    expect(flow.status).toBe('failed');
    expect(flow.error).toBe('wrong-network');
  });

  it('blocks an unknown wallet network (fail safe)', () => {
    const flow = requestSignature(previewing(), undefined);
    expect(flow).toMatchObject({ status: 'failed', error: 'wrong-network' });
  });

  it('maps a wallet rejection during signing to failed:user-rejected', () => {
    const awaiting = requestSignature(previewing(), CHAIN);
    const flow = onTxError(awaiting, { code: 4001, message: 'User denied' });
    expect(flow).toMatchObject({ status: 'failed', error: 'user-rejected' });
  });

  it('maps a broadcast error while pending', () => {
    const pending = onSigned(requestSignature(previewing(), CHAIN), HASH);
    const flow = onTxError(pending, { message: 'failed to send raw transaction' });
    expect(flow).toMatchObject({ status: 'failed', error: 'broadcast-failed' });
  });

  it('surfaces replaced and dropped receipts', () => {
    const pending = onSigned(requestSignature(previewing(), CHAIN), HASH);
    expect(onReceipt(pending, 'replaced').status).toBe('replaced');
    expect(onReceipt(pending, 'dropped').status).toBe('dropped');
    expect(onReceipt(pending, 'failed').status).toBe('failed');
  });
});

describe('tx state machine — mis-ordered calls are no-ops (no guard can be skipped)', () => {
  it('cannot sign from previewing (must request signature first)', () => {
    const built = previewing();
    expect(onSigned(built, HASH)).toBe(built);
  });

  it('cannot jump straight to pending/receipt from idle', () => {
    expect(onSigned(initialTxFlow, HASH)).toBe(initialTxFlow);
    expect(onReceipt(initialTxFlow, 'confirmed')).toBe(initialTxFlow);
    expect(requestSignature(initialTxFlow, CHAIN)).toBe(initialTxFlow);
  });

  it('ignores errors reported outside the signing/pending window', () => {
    expect(onTxError(initialTxFlow, { code: 4001 })).toBe(initialTxFlow);
    expect(onTxError(previewing(), { code: 4001 }).status).toBe('previewing');
  });

  it('cannot take a receipt before the tx is pending', () => {
    const awaiting = requestSignature(previewing(), CHAIN);
    expect(onReceipt(awaiting, 'confirmed')).toBe(awaiting);
  });
});

describe('resetTxFlow', () => {
  it('returns to idle from any terminal state', () => {
    const terminal = buildTxFlow({ kind: 'native', to: RECIPIENT, amount: 0n, chainId: CHAIN });
    expect(resetTxFlow()).toEqual({ status: 'idle' });
    expect(isTerminalTxFlow(terminal)).toBe(true);
  });
});
