import { describe, expect, it } from 'vitest';
import { decodeFunctionData, encodeFunctionData, erc20Abi, getAddress } from 'viem';
import {
  buildSendTx,
  decodeSendTx,
  assertShownEqualsSigned,
  TxDecodeError,
  EMPTY_CALLDATA,
  ERC20_TRANSFER_SELECTOR,
  type DecodedSend,
} from './tx-build';

// Lowercase on purpose — the module must re-checksum. Not production addresses.
const RECIPIENT = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed';
const RECIPIENT_CS = getAddress(RECIPIENT);
const TOKEN = '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238';
const TOKEN_CS = getAddress(TOKEN);
const OTHER = '0x00000000000000000000000000000000deadbeef';
const CHAIN = 11155111; // Sepolia

describe('buildSendTx — native', () => {
  it('builds a plain value transfer with empty calldata', () => {
    const req = buildSendTx({ kind: 'native', to: RECIPIENT, amount: 10n ** 18n, chainId: CHAIN });
    expect(req).toEqual({
      to: RECIPIENT_CS,
      value: 10n ** 18n,
      data: EMPTY_CALLDATA,
      chainId: CHAIN,
    });
  });

  it('re-checksums a lowercase recipient', () => {
    const req = buildSendTx({ kind: 'native', to: RECIPIENT, amount: 1n, chainId: CHAIN });
    expect(req.to).toBe(RECIPIENT_CS);
    expect(req.to).not.toBe(RECIPIENT);
  });

  it('rejects a zero or negative amount (fail safe)', () => {
    expect(() => buildSendTx({ kind: 'native', to: RECIPIENT, amount: 0n, chainId: CHAIN })).toThrow(
      TxDecodeError,
    );
    expect(() =>
      buildSendTx({ kind: 'native', to: RECIPIENT, amount: -5n, chainId: CHAIN }),
    ).toThrow(TxDecodeError);
  });

  it('rejects a malformed recipient', () => {
    expect(() => buildSendTx({ kind: 'native', to: 'not-an-address', amount: 1n, chainId: CHAIN })).toThrow();
  });
});

describe('buildSendTx — erc20', () => {
  it('encodes transfer(), carries no native value, targets the token', () => {
    const req = buildSendTx({
      kind: 'erc20',
      to: RECIPIENT,
      amount: 1_000_000n,
      chainId: CHAIN,
      tokenAddress: TOKEN,
    });
    expect(req.to).toBe(TOKEN_CS);
    expect(req.value).toBe(0n);
    expect(req.data.startsWith(ERC20_TRANSFER_SELECTOR)).toBe(true);
    // The calldata really decodes to transfer(recipient, amount).
    const decoded = decodeFunctionData({ abi: erc20Abi, data: req.data });
    expect(decoded.functionName).toBe('transfer');
    expect(decoded.args[0]).toBe(RECIPIENT_CS);
    expect(decoded.args[1]).toBe(1_000_000n);
  });

  it('requires a token address', () => {
    expect(() =>
      buildSendTx({ kind: 'erc20', to: RECIPIENT, amount: 1n, chainId: CHAIN }),
    ).toThrow(TxDecodeError);
  });
});

describe('decodeSendTx — round-trips what was built', () => {
  it('native', () => {
    const req = buildSendTx({ kind: 'native', to: RECIPIENT, amount: 42n, chainId: CHAIN });
    expect(decodeSendTx(req)).toEqual({
      kind: 'native',
      recipient: RECIPIENT_CS,
      amount: 42n,
      chainId: CHAIN,
    });
  });

  it('erc20', () => {
    const req = buildSendTx({
      kind: 'erc20',
      to: RECIPIENT,
      amount: 2_500_000n,
      chainId: CHAIN,
      tokenAddress: TOKEN,
    });
    expect(decodeSendTx(req)).toEqual({
      kind: 'erc20',
      recipient: RECIPIENT_CS,
      amount: 2_500_000n,
      chainId: CHAIN,
      tokenAddress: TOKEN_CS,
    });
  });
});

describe('decodeSendTx — refuses anything it cannot read safely (P2)', () => {
  it('rejects a token call that also carries native value', () => {
    const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [RECIPIENT_CS, 1n] });
    expect(() => decodeSendTx({ to: TOKEN_CS, value: 1n, data, chainId: CHAIN })).toThrow(TxDecodeError);
  });

  it('rejects calldata for a different ERC-20 function (e.g. approve)', () => {
    const data = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [OTHER, 1n] });
    expect(() => decodeSendTx({ to: TOKEN_CS, value: 0n, data, chainId: CHAIN })).toThrow(TxDecodeError);
  });

  it('rejects undecodable garbage calldata', () => {
    expect(() => decodeSendTx({ to: TOKEN_CS, value: 0n, data: '0xdeadbeef', chainId: CHAIN })).toThrow(
      TxDecodeError,
    );
  });
});

describe('assertShownEqualsSigned — P3: shown must equal signed', () => {
  const req = buildSendTx({
    kind: 'erc20',
    to: RECIPIENT,
    amount: 1_000_000n,
    chainId: CHAIN,
    tokenAddress: TOKEN,
  });
  const faithful: DecodedSend = decodeSendTx(req);

  it('passes when the shown preview matches the request', () => {
    expect(() => assertShownEqualsSigned(req, faithful)).not.toThrow();
  });

  it('passes even if the shown addresses are a different case', () => {
    expect(() =>
      assertShownEqualsSigned(req, {
        ...faithful,
        recipient: RECIPIENT as `0x${string}`,
        tokenAddress: TOKEN as `0x${string}`,
      }),
    ).not.toThrow();
  });

  it('BLOCKS a tampered amount', () => {
    expect(() => assertShownEqualsSigned(req, { ...faithful, amount: 1n })).toThrow(TxDecodeError);
  });

  it('BLOCKS a tampered recipient', () => {
    expect(() =>
      assertShownEqualsSigned(req, { ...faithful, recipient: getAddress(OTHER) }),
    ).toThrow(TxDecodeError);
  });

  it('BLOCKS a tampered chainId', () => {
    expect(() => assertShownEqualsSigned(req, { ...faithful, chainId: 1 })).toThrow(TxDecodeError);
  });

  it('BLOCKS a kind/token mismatch', () => {
    const nativeReq = buildSendTx({ kind: 'native', to: RECIPIENT, amount: 1_000_000n, chainId: CHAIN });
    // Claim it is the erc20 send, but hand over the native request.
    expect(() => assertShownEqualsSigned(nativeReq, faithful)).toThrow(TxDecodeError);
  });
});
