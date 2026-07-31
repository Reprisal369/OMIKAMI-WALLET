/**
 * OMIKAMI SHIELD — read-only send PREVIEW.
 *
 * This module models a hypothetical transfer purely so the interface can show
 * the user what a send WOULD look like and warn about dangerous inputs
 * BEFORE anything is signed. It is pure and side-effect free:
 *   - it never signs, broadcasts, or touches a wallet;
 *   - it never models seed phrases, private keys, or raw signing material;
 *   - `signingAvailable` is hard-wired to `false` in this build.
 *
 * Heuristics (poisoning, token-contract recipient, lookalike) are surfaced as
 * warnings, never as confirmed verdicts. The final authority is always the
 * user's own wallet — which, in this build, is never asked to sign.
 */
import type { SecurityCheck } from '@omikami/types';
import { isLookalikeAddress, validateAddress } from './index';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// ---------------------------------------------------------------------------
// Amount parsing — integer only, never floating point
// ---------------------------------------------------------------------------

export interface AmountParse {
  valid: boolean;
  /** Parsed value in the asset's smallest unit (base units). */
  value?: bigint;
  reason?: 'empty' | 'format' | 'too-many-decimals' | 'zero';
}

/**
 * Parses a human-typed decimal amount into base units without any floating
 * point math. Accepts only digits and a single decimal point — no signs, no
 * exponent, no thousands separators (all of which are common spoofing or
 * fat-finger vectors).
 */
export function parseAmountInput(input: string, decimals: number): AmountParse {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { valid: false, reason: 'empty' };
  // Non-ambiguous decimal shape (CodeQL: avoid the polynomial `\d*\.?\d*`).
  // `\d*(?:\.\d*)?` accepts the same language — optional integer part, at most
  // one dot, optional fraction — but with a single, unambiguous parse, so there
  // is no super-linear backtracking on adversarial input.
  if (trimmed === '.' || !/^\d*(?:\.\d*)?$/.test(trimmed)) return { valid: false, reason: 'format' };

  const [wholeRaw = '', fracRaw = ''] = trimmed.split('.');
  if (fracRaw.length > decimals) return { valid: false, reason: 'too-many-decimals' };

  const whole = wholeRaw === '' ? '0' : wholeRaw;
  const frac = fracRaw.padEnd(decimals, '0');
  const combined = `${whole}${frac}`.replace(/^0+/, '') || '0';
  const value = BigInt(combined);
  if (value === 0n) return { valid: false, reason: 'zero' };
  return { valid: true, value };
}

// ---------------------------------------------------------------------------
// Send preview
// ---------------------------------------------------------------------------

export interface SendPreviewAsset {
  kind: 'native' | 'erc20';
  symbol: string;
  decimals: number;
  /** ERC-20 contract address (checksummed). Absent for the native asset. */
  contractAddress?: string;
  /** True only for assets in the reviewed token registry. */
  verified: boolean;
}

export interface SendPreviewInput {
  /** Connected user's address, if any. */
  fromAddress?: string;
  recipientInput: string;
  amountInput: string;
  asset: SendPreviewAsset;
  /** Available balance in base units, when known. Enables the over-balance check. */
  availableBalance?: bigint;
  /**
   * Addresses the user is likely to confuse a poisoned recipient with:
   * their own address plus known contract addresses. Used for the
   * lookalike heuristic. Never treated as an allowlist.
   */
  knownAddresses?: readonly string[];
  /** Hard gate from chain-config; must be false in phase one/this build. */
  transactionsEnabled: boolean;
}

export interface SendPreview {
  recipient: {
    valid: boolean;
    checksummed?: `0x${string}`;
    reason?: 'empty' | 'format' | 'checksum';
  };
  amount: AmountParse;
  checks: SecurityCheck[];
  /**
   * True when the preview contains a blocking problem or invalid input. Even
   * if signing were enabled, the interface must refuse to proceed.
   */
  wouldBlock: boolean;
  /**
   * ALWAYS false in this build: no code path can sign or broadcast. Exposed so
   * the UI (and tests) can assert the read-only invariant explicitly.
   */
  signingAvailable: false;
}

function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Builds a full, read-only preview of a hypothetical transfer with SHIELD
 * warnings. Pure: identical inputs always yield identical output.
 */
export function buildSendPreview(input: SendPreviewInput): SendPreview {
  const checks: SecurityCheck[] = [];

  // 1. Read-only / signing gate — stated first, unconditionally.
  if (input.transactionsEnabled) {
    checks.push({
      id: 'signing',
      label: 'Signing unexpectedly enabled',
      status: 'blocked',
      detail:
        'Transaction features report as enabled, which must not happen in this build. This is a bug — do not trust this interface until it is fixed. Report it.',
    });
  } else {
    checks.push({
      id: 'signing',
      label: 'Preview only — nothing is signed',
      status: 'ok',
      detail:
        'This build cannot sign or broadcast transactions. This screen shows what a transfer would look like and checks it for danger; your wallet is never asked to sign.',
    });
  }

  // 2. Recipient.
  const recipientRaw = input.recipientInput.trim();
  const recipient = validateAddress(recipientRaw);

  if (recipient.reason === 'empty') {
    checks.push({
      id: 'recipient',
      label: 'Recipient',
      status: 'info',
      detail: 'Enter a recipient address to preview a transfer.',
    });
  } else if (recipient.reason === 'format') {
    checks.push({
      id: 'recipient',
      label: 'Recipient is not a valid address',
      status: 'blocked',
      detail:
        'This is not a valid Ethereum address. A valid address is 42 characters: “0x” followed by 40 hexadecimal characters.',
    });
  } else if (recipient.reason === 'checksum') {
    checks.push({
      id: 'recipient',
      label: 'Recipient failed its checksum',
      status: 'blocked',
      detail:
        'This address failed its EIP-55 checksum. Mixed-case addresses carry a built-in integrity check, and this one does not match — it may have been corrupted or altered in transit. Do not use it.',
    });
  } else if (recipient.valid && recipient.checksummed) {
    const to = recipient.checksummed;

    if (sameAddress(to, ZERO_ADDRESS)) {
      checks.push({
        id: 'recipient',
        label: 'Recipient is the zero address',
        status: 'blocked',
        detail:
          'This is the zero address (0x0000…0000). Funds sent here are burned permanently and cannot be recovered.',
      });
    } else if (
      input.asset.kind === 'erc20' &&
      input.asset.contractAddress &&
      sameAddress(to, input.asset.contractAddress)
    ) {
      checks.push({
        id: 'recipient',
        label: 'Recipient is this token’s own contract',
        status: 'blocked',
        detail:
          'The recipient is the token contract itself, not a wallet. Tokens sent to their own contract are almost always unrecoverable.',
      });
    } else if (input.fromAddress && sameAddress(to, input.fromAddress)) {
      checks.push({
        id: 'recipient',
        label: 'Recipient is your own address',
        status: 'warning',
        detail:
          'You are about to send to your own connected address. This is allowed but usually a mistake — double-check that this is what you intend.',
      });
    } else {
      const lookalike = (input.knownAddresses ?? []).some((known) =>
        isLookalikeAddress(to, known),
      );
      if (lookalike) {
        checks.push({
          id: 'recipient',
          label: 'Possible address poisoning',
          status: 'warning',
          detail:
            'This address shares the first and last characters of an address you already know but is NOT identical to it — the classic address-poisoning pattern. Compare every character, not just the ends, before trusting it.',
        });
      } else {
        checks.push({
          id: 'recipient',
          label: 'Recipient looks well-formed',
          status: 'ok',
          detail:
            'Valid checksummed address. A valid format is not a safety guarantee — only send to addresses you have independently verified.',
        });
      }
    }
  }

  // 3. Amount.
  const amount = parseAmountInput(input.amountInput, input.asset.decimals);
  if (amount.reason === 'empty') {
    checks.push({
      id: 'amount',
      label: 'Amount',
      status: 'info',
      detail: `Enter an amount of ${input.asset.symbol} to preview.`,
    });
  } else if (amount.reason === 'format') {
    checks.push({
      id: 'amount',
      label: 'Amount is not a valid number',
      status: 'blocked',
      detail: 'Enter a plain decimal number, for example 1.5. No signs, spaces, or separators.',
    });
  } else if (amount.reason === 'too-many-decimals') {
    checks.push({
      id: 'amount',
      label: 'Too many decimal places',
      status: 'blocked',
      detail: `${input.asset.symbol} supports at most ${input.asset.decimals} decimal places.`,
    });
  } else if (amount.reason === 'zero') {
    checks.push({
      id: 'amount',
      label: 'Amount is zero',
      status: 'warning',
      detail: 'A zero-value transfer moves no funds. Enter a positive amount.',
    });
  } else if (amount.valid && amount.value !== undefined) {
    if (input.availableBalance !== undefined && amount.value > input.availableBalance) {
      checks.push({
        id: 'amount',
        label: 'Amount exceeds your balance',
        status: 'blocked',
        detail:
          'This is more than your available balance for this asset. A real wallet would reject or fail this transfer.',
      });
    } else {
      checks.push({
        id: 'amount',
        label: 'Amount is within balance',
        status: 'ok',
        detail:
          input.availableBalance === undefined
            ? 'Amount parsed. Balance is unknown, so it was not checked against your funds.'
            : 'Amount parsed and is within your available balance for this asset.',
      });
    }
  }

  // 4. Asset trust.
  if (input.asset.kind === 'erc20' && !input.asset.verified) {
    checks.push({
      id: 'asset',
      label: 'Token is not in the reviewed registry',
      status: 'warning',
      detail:
        'This token is not one of the addresses reviewed and recorded in this build. Confirm its contract address independently before trusting it.',
    });
  } else {
    checks.push({
      id: 'asset',
      label: input.asset.kind === 'native' ? 'Native asset' : 'Verified token',
      status: 'ok',
      detail:
        input.asset.kind === 'native'
          ? 'The network’s native asset. No token contract is involved in a native transfer.'
          : 'This token is in the reviewed registry for this network.',
    });
  }

  const wouldBlock =
    checks.some((c) => c.status === 'blocked') ||
    !recipient.valid ||
    !amount.valid;

  return {
    recipient: {
      valid: recipient.valid,
      ...(recipient.checksummed ? { checksummed: recipient.checksummed } : {}),
      ...(recipient.reason ? { reason: recipient.reason } : {}),
    },
    amount,
    checks,
    wouldBlock,
    signingAvailable: false,
  };
}
