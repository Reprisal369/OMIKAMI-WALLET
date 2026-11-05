/**
 * OMIKAMI SHIELD — pure transaction construction & decoding (Phase 2).
 *
 * Pure and side-effect free: this module BUILDS the immutable transaction
 * request object and DECODES it back, but it never signs, broadcasts, or
 * touches a wallet. The actual wallet write call lives only in the reviewed
 * write-surface module `apps/web/src/lib/tx/` (design §5); nothing here is a
 * wallet API.
 *
 * Guarantee (threat P3, design §4.7): the preview the user sees is produced by
 * DECODING the request's own calldata — the exact bytes a wallet would be
 * handed — so an encode-vs-display mismatch is not representable. Immediately
 * before any future hand-off, `assertShownEqualsSigned` re-decodes the outgoing
 * request and hard-blocks on ANY divergence (fail safe).
 *
 * Transactions remain disabled in this build; this is the construction logic
 * that a later, feature-flagged send flow will build on.
 */
import { decodeFunctionData, encodeFunctionData, erc20Abi, getAddress } from 'viem';
import type { TxRequest } from '@omikami/types';

/** Calldata for a plain native-value transfer: none. */
export const EMPTY_CALLDATA = '0x' as const;

/** The 4-byte selector of ERC-20 `transfer(address,uint256)`. */
export const ERC20_TRANSFER_SELECTOR = '0xa9059cbb';

/**
 * A decode failure. Named so callers can map it to the `decode-failed`
 * transaction error (design §10) and block — never blind-sign (threat P2).
 */
export class TxDecodeError extends Error {
  readonly kind = 'decode-failed' as const;
  constructor(message: string) {
    super(message);
    this.name = 'TxDecodeError';
  }
}

export interface BuildSendParams {
  /** 'native' sends the chain's own asset; 'erc20' calls `transfer`. */
  kind: 'native' | 'erc20';
  /** Recipient address (any case; re-checksummed here). */
  to: string;
  /** Amount in the asset's base units — always a bigint, never a float. */
  amount: bigint;
  chainId: number;
  /** Required for `erc20`: the token contract (any case; re-checksummed). */
  tokenAddress?: string;
}

/** A send decoded back FROM a {@link TxRequest} — what the UI must display. */
export interface DecodedSend {
  kind: 'native' | 'erc20';
  /** The final recipient of the value or tokens. */
  recipient: `0x${string}`;
  amount: bigint;
  chainId: number;
  /** Present only for `erc20`: the token contract that is called. */
  tokenAddress?: `0x${string}`;
}

/**
 * Builds the single immutable {@link TxRequest} for a native or ERC-20 send.
 * Invalid inputs throw ({@link TxDecodeError}) rather than producing a request —
 * a request object only ever represents a well-formed intent.
 */
export function buildSendTx(params: BuildSendParams): TxRequest {
  if (params.amount <= 0n) {
    throw new TxDecodeError('amount must be a positive number of base units');
  }
  // getAddress throws on a malformed/bad-checksum address → fail safe.
  const recipient = getAddress(params.to);

  if (params.kind === 'native') {
    return { to: recipient, value: params.amount, data: EMPTY_CALLDATA, chainId: params.chainId };
  }

  if (!params.tokenAddress) {
    throw new TxDecodeError('an ERC-20 send requires a token contract address');
  }
  const token = getAddress(params.tokenAddress);
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [recipient, params.amount],
  });
  // An ERC-20 transfer moves no native value; the token amount is in calldata.
  return { to: token, value: 0n, data, chainId: params.chainId };
}

/**
 * Decodes a {@link TxRequest} back into the human-meaningful send it represents,
 * reading the request's OWN bytes. Anything that does not decode to a clean
 * native transfer or ERC-20 `transfer` throws — there is no "unknown, just sign
 * it" path (threat P2).
 */
export function decodeSendTx(req: TxRequest): DecodedSend {
  if (req.data === EMPTY_CALLDATA) {
    return {
      kind: 'native',
      recipient: getAddress(req.to),
      amount: req.value,
      chainId: req.chainId,
    };
  }

  // Beyond this point it is a contract call, so it must carry no native value.
  if (req.value !== 0n) {
    throw new TxDecodeError('a token transfer must not also carry native value');
  }

  let decoded;
  try {
    decoded = decodeFunctionData({ abi: erc20Abi, data: req.data });
  } catch {
    throw new TxDecodeError('calldata does not decode against the ERC-20 ABI');
  }
  if (decoded.functionName !== 'transfer') {
    throw new TxDecodeError(`unexpected function in calldata: ${String(decoded.functionName)}`);
  }
  const [to, amount] = decoded.args;
  return {
    kind: 'erc20',
    recipient: getAddress(to),
    amount,
    chainId: req.chainId,
    tokenAddress: getAddress(req.to),
  };
}

function normalizeTokenAddress(value: string | undefined): `0x${string}` | undefined {
  return value === undefined ? undefined : getAddress(value);
}

/**
 * P3 structural check (design §4.7): re-decode the outgoing request and assert
 * it equals exactly what the UI showed the user. Any divergence throws
 * ({@link TxDecodeError}) and the request must NOT be handed to a wallet. This
 * makes parameter tampering (threat P3) unrepresentable rather than merely
 * tested: the only thing that can be signed is the thing that was decoded for
 * display.
 */
export function assertShownEqualsSigned(req: TxRequest, shown: DecodedSend): void {
  const actual = decodeSendTx(req);
  const mismatch =
    actual.kind !== shown.kind ||
    actual.recipient !== getAddress(shown.recipient) ||
    actual.amount !== shown.amount ||
    actual.chainId !== shown.chainId ||
    normalizeTokenAddress(actual.tokenAddress) !== normalizeTokenAddress(shown.tokenAddress);
  if (mismatch) {
    throw new TxDecodeError(
      'the transaction shown to the user does not match the request that would be signed',
    );
  }
}
