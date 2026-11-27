/**
 * STATUS: REVIEW — tests for the read-only transaction simulation engine.
 * Uses a MOCKED read client (no real provider, no network, no signing). The
 * central safety properties: a successful pre-flight is never "safe"; every
 * uncertainty fails closed; and the client is never asked to sign or send.
 */
import { describe, expect, it, vi } from 'vitest';
import { getAddress } from 'viem';
import {
  classifyRpcError,
  classifySimulationOutcome,
  simulateSend,
  simulationKey,
  isSimulationStale,
  type SimulationClient,
  type SimulationContext,
} from './tx-simulation';
import type { TxRequest } from '@omikami/types';

const FROM = getAddress('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed');
const TO = getAddress('0x00000000000000000000000000000000deadbeef');
const USDC = getAddress('0x1c7d4b196cb0c7b01d743fbc6116a902379c7238');
const SEPOLIA = 11155111;

const NATIVE_REQ: TxRequest = { to: TO, value: 10n ** 15n, data: '0x', chainId: SEPOLIA };
const NATIVE_CTX: SimulationContext = { kind: 'native', assetVerified: true };

function mockClient(
  impl?: SimulationClient['estimateGas'],
  chainId = SEPOLIA,
): SimulationClient & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    chainId,
    calls,
    estimateGas: vi.fn(async (args: Parameters<SimulationClient['estimateGas']>[0]) => {
      calls.push(args);
      return impl ? impl(args) : 21_000n;
    }),
  };
}

describe('classifyRpcError', () => {
  it('maps reverts, gas-exceeds and contract reverts', () => {
    expect(classifyRpcError({ message: 'execution reverted: ERC20: transfer amount exceeds balance' }).kind).toBe('revert');
    expect(classifyRpcError({ message: 'gas required exceeds allowance' }).kind).toBe('revert');
    expect(classifyRpcError({ name: 'ContractFunctionRevertError' }).kind).toBe('revert');
  });
  it('maps insufficient funds, timeout and malformed', () => {
    expect(classifyRpcError({ message: 'insufficient funds for gas * price + value' }).kind).toBe('insufficient-funds');
    expect(classifyRpcError({ message: 'request timed out' }).kind).toBe('timeout');
    expect(classifyRpcError({ message: 'invalid json response' }).kind).toBe('malformed');
    expect(classifyRpcError({ name: 'SyntaxError', message: 'Unexpected token < in JSON' }).kind).toBe('malformed');
  });
  it('falls back to unavailable and never throws on odd input', () => {
    expect(classifyRpcError({ message: 'something odd' }).kind).toBe('unavailable');
    expect(classifyRpcError(null).kind).toBe('unavailable');
    expect(classifyRpcError('a string').kind).toBe('unavailable');
  });
});

describe('classifySimulationOutcome — never "safe", always distinguishes advisory', () => {
  it('native success → passed, with an explicit non-guarantee caveat', () => {
    const s = classifySimulationOutcome({ kind: 'gas', gas: 21_000n }, NATIVE_CTX);
    expect(s.status).toBe('passed');
    expect(s.wouldRevert).toBe(false);
    expect(s.gasEstimate).toBe(21_000n);
    expect(s.detail.toLowerCase()).not.toContain('safe to');
    expect(s.detail).toMatch(/not a (safety )?verdict|not a guarantee/i);
    expect(s.detail).toMatch(/does not compute balance changes/i);
  });
  it('verified erc20 success → passed', () => {
    const s = classifySimulationOutcome({ kind: 'gas', gas: 55_000n }, { kind: 'erc20', assetVerified: true });
    expect(s.status).toBe('passed');
  });
  it('UNVERIFIED erc20 success → unverified, never passed', () => {
    const s = classifySimulationOutcome({ kind: 'gas', gas: 55_000n }, { kind: 'erc20', assetVerified: false });
    expect(s.status).toBe('unverified');
    expect(s.wouldRevert).toBe(false);
  });
  it('revert → revert, wouldRevert true', () => {
    const s = classifySimulationOutcome({ kind: 'revert', reason: 'amount exceeds balance' }, NATIVE_CTX);
    expect(s.status).toBe('revert');
    expect(s.wouldRevert).toBe(true);
    expect(s.detail).toContain('amount exceeds balance');
  });
  it('insufficient-funds → warning', () => {
    expect(classifySimulationOutcome({ kind: 'insufficient-funds' }, NATIVE_CTX).status).toBe('warning');
  });
  it('timeout / malformed / unavailable → unavailable', () => {
    expect(classifySimulationOutcome({ kind: 'timeout' }, NATIVE_CTX).status).toBe('unavailable');
    expect(classifySimulationOutcome({ kind: 'malformed' }, NATIVE_CTX).status).toBe('unavailable');
    expect(classifySimulationOutcome({ kind: 'unavailable' }, NATIVE_CTX).status).toBe('unavailable');
  });
});

describe('simulateSend — fails closed, uses only a read client, never signs', () => {
  it('a clean native pre-flight passes and calls estimateGas exactly once', async () => {
    const client = mockClient();
    const s = await simulateSend({ request: NATIVE_REQ, from: FROM, walletChainId: SEPOLIA, context: NATIVE_CTX, client });
    expect(s.status).toBe('passed');
    expect(s.gasEstimate).toBe(21_000n);
    expect(client.estimateGas).toHaveBeenCalledTimes(1);
    // The injected client's TYPE exposes only `estimateGas` (a read) — there is
    // no write/sign method to call; this is enforced at compile time.
  });

  it('a reverting estimate → revert', async () => {
    const client = mockClient(async () => {
      throw new Error('execution reverted');
    });
    const s = await simulateSend({ request: NATIVE_REQ, from: FROM, walletChainId: SEPOLIA, context: NATIVE_CTX, client });
    expect(s).toMatchObject({ status: 'revert', wouldRevert: true });
  });

  it('insufficient funds → warning', async () => {
    const client = mockClient(async () => {
      throw new Error('insufficient funds for gas * price + value');
    });
    expect((await simulateSend({ request: NATIVE_REQ, from: FROM, walletChainId: SEPOLIA, context: NATIVE_CTX, client })).status).toBe('warning');
  });

  it('timeout and malformed responses → unavailable', async () => {
    const t = mockClient(async () => {
      throw new Error('request timed out');
    });
    const m = mockClient(async () => {
      throw Object.assign(new SyntaxError('Unexpected token < in JSON'), {});
    });
    expect((await simulateSend({ request: NATIVE_REQ, from: FROM, walletChainId: SEPOLIA, context: NATIVE_CTX, client: t })).status).toBe('unavailable');
    expect((await simulateSend({ request: NATIVE_REQ, from: FROM, walletChainId: SEPOLIA, context: NATIVE_CTX, client: m })).status).toBe('unavailable');
  });

  it('no account → unavailable and makes NO RPC call', async () => {
    const client = mockClient();
    const s = await simulateSend({ request: NATIVE_REQ, from: undefined, walletChainId: SEPOLIA, context: NATIVE_CTX, client });
    expect(s.status).toBe('unavailable');
    expect(client.estimateGas).not.toHaveBeenCalled();
  });

  it('wrong/unknown network → unavailable and makes NO RPC call (fail closed)', async () => {
    const client = mockClient();
    expect((await simulateSend({ request: NATIVE_REQ, from: FROM, walletChainId: 1, context: NATIVE_CTX, client })).status).toBe('unavailable');
    expect((await simulateSend({ request: NATIVE_REQ, from: FROM, walletChainId: undefined, context: NATIVE_CTX, client })).status).toBe('unavailable');
    expect(client.estimateGas).not.toHaveBeenCalled();
  });

  it('a client reading a different chain than the request (conflicting source) → unavailable, no call', async () => {
    const client = mockClient(undefined, 1); // client.chainId = mainnet, request targets Sepolia
    const s = await simulateSend({ request: NATIVE_REQ, from: FROM, walletChainId: SEPOLIA, context: NATIVE_CTX, client });
    expect(s.status).toBe('unavailable');
    expect(client.estimateGas).not.toHaveBeenCalled();
  });

  it('an unverified-token pre-flight that succeeds is UNVERIFIED, never passed', async () => {
    const req: TxRequest = { to: USDC, value: 0n, data: '0xa9059cbb', chainId: SEPOLIA };
    const s = await simulateSend({ request: req, from: FROM, walletChainId: SEPOLIA, context: { kind: 'erc20', assetVerified: false }, client: mockClient() });
    expect(s.status).toBe('unverified');
  });
});

describe('staleness / account & network invalidation', () => {
  it('same account, network and request bytes → not stale', () => {
    const a = simulationKey(FROM, NATIVE_REQ);
    const b = simulationKey(FROM, NATIVE_REQ);
    expect(isSimulationStale(a, b)).toBe(false);
  });
  it('account change invalidates', () => {
    const a = simulationKey(FROM, NATIVE_REQ);
    const b = simulationKey(getAddress('0x000000000000000000000000000000000000beef'), NATIVE_REQ);
    expect(isSimulationStale(a, b)).toBe(true);
  });
  it('network change invalidates', () => {
    const a = simulationKey(FROM, NATIVE_REQ);
    const b = simulationKey(FROM, { ...NATIVE_REQ, chainId: 1 });
    expect(isSimulationStale(a, b)).toBe(true);
  });
  it('edited amount or recipient invalidates', () => {
    const base = simulationKey(FROM, NATIVE_REQ);
    expect(isSimulationStale(base, simulationKey(FROM, { ...NATIVE_REQ, value: 999n }))).toBe(true);
    expect(isSimulationStale(base, simulationKey(FROM, { ...NATIVE_REQ, to: USDC }))).toBe(true);
  });
});
