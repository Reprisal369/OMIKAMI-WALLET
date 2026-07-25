import { z } from 'zod';
import { formatUnits, getAddress, isAddress } from 'viem';

export const tokenStatusSchema = z.enum(['verified', 'unverified', 'unknown', 'suspicious']);
export type TokenStatus = z.infer<typeof tokenStatusSchema>;

/**
 * Token identity is ALWAYS chainId + EIP-55 checksummed contract address.
 * `symbol` and `name` are untrusted display strings: length-capped here and
 * rendered as plain text only (never HTML) by the UI.
 */
export const tokenEntrySchema = z.object({
  chainId: z.number().int().positive(),
  address: z
    .string()
    .refine(
      (a) => isAddress(a, { strict: false }) && a === getAddress(a),
      'must be an EIP-55 checksummed address',
    ),
  symbol: z.string().min(1).max(20),
  name: z.string().min(1).max(64),
  decimals: z.number().int().min(0).max(255),
  status: tokenStatusSchema,
  /** Where and when this entry was verified. Required for every entry. */
  evidence: z.string().min(1),
});

export type TokenEntry = z.infer<typeof tokenEntrySchema>;

/**
 * Reviewed token registry. Entries are added ONLY with recorded verification
 * evidence; this repository never invents token addresses.
 */
const RAW_TOKENS: TokenEntry[] = [
  {
    chainId: 11155111, // Ethereum Sepolia
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    symbol: 'USDC',
    name: 'USDC (Sepolia test token)',
    decimals: 6,
    status: 'verified',
    evidence:
      'Issuer documentation: developers.circle.com/stablecoins/usdc-contract-addresses, "Ethereum Sepolia" row, retrieved 2026-07-13; Circle links the same address on sepolia.etherscan.io. Testnet token without financial value.',
  },
];

export const VERIFIED_TOKENS: readonly TokenEntry[] = RAW_TOKENS.map((t) =>
  tokenEntrySchema.parse(t),
);

/**
 * Human-friendly token amount: trims trailing zeros, never uses floating
 * point math, and marks truncation explicitly instead of silently rounding.
 */
export function formatTokenAmount(value: bigint, decimals: number): string {
  const s = formatUnits(value, decimals);
  if (!s.includes('.')) return s;
  const [whole, fraction = ''] = s.split('.');
  const trimmed = fraction.replace(/0+$/, '');
  if (trimmed.length === 0) return whole ?? '0';
  if (trimmed.length > 6) return `≈ ${whole}.${trimmed.slice(0, 6)}`;
  return `${whole}.${trimmed}`;
}

/**
 * Defensive display sanitizer for chain-derived token text (THREAT_MODEL D3):
 * strips control characters and angle brackets, collapses whitespace, caps length.
 */
export function sanitizeTokenText(input: string, maxLength = 32): string {
  let cleaned = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 32 || code === 127 || ch === '<' || ch === '>') continue;
    cleaned += ch;
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}…` : cleaned;
}
