/**
 * OMIKAMI WALLET — the ONLY module permitted to use browser storage.
 * Threat model: THREAT_MODEL.md C1c (opt-in persistence). Stores exactly one
 * value: a user-chosen, validated public https RPC URL under a single key.
 * Never stores addresses, keys, balances, or history. Values are re-validated
 * on read, so a tampered entry is ignored rather than trusted.
 *
 * The scoped eslint-disable + the check-forbidden-terms allowlist entry for
 * this file are deliberate and reviewed; do not copy this pattern elsewhere.
 */
import { validateRpcUrl } from '@omikami/security';

const KEY = 'omikami.rpcUrl';

function store(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Returns the stored custom endpoint only if it is still valid, else null. */
export function readCustomRpcUrl(): string | null {
  const s = store();
  if (!s) return null;
  const raw = s.getItem(KEY);
  if (!raw) return null;
  const check = validateRpcUrl(raw);
  return check.valid ? (check.normalized ?? null) : null;
}

/** Persists a validated endpoint. Returns false if the URL is rejected. */
export function writeCustomRpcUrl(url: string): boolean {
  const check = validateRpcUrl(url);
  if (!check.valid || !check.normalized) return false;
  const s = store();
  if (!s) return false;
  s.setItem(KEY, check.normalized);
  return true;
}

/** Removes the custom endpoint (reverts to the built-in default). */
export function clearCustomRpcUrl(): void {
  store()?.removeItem(KEY);
}
