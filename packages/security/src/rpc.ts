/**
 * OMIKAMI SHIELD — user-supplied RPC endpoint validation (phase 2b).
 * Pure function. A custom endpoint is a real security surface: it can lie
 * about chain state and see the user's IP + queried addresses. We therefore
 * reject anything that is not a plain https URL to a public host.
 * Rules follow the owner's C-review: https only, no localhost / internal
 * networks / dangerous schemes.
 */

export type RpcRejectReason =
  | 'empty'
  | 'not-a-url'
  | 'not-https'
  | 'has-credentials'
  | 'internal-host'
  | 'not-public';

export interface RpcValidation {
  valid: boolean;
  normalized?: string;
  reason?: RpcRejectReason;
}

// Hosts / ranges that must never be used as a "public" RPC endpoint.
function isInternalHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (h === '0.0.0.0' || h === '::1' || h === '[::1]') return true;
  // IPv4 private / loopback / link-local / CGNAT ranges.
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  // Any IPv6 literal or hostname without a dot is not a public DNS name.
  if (h.startsWith('[')) return true;
  return false;
}

export function validateRpcUrl(input: string): RpcValidation {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { valid: false, reason: 'empty' };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { valid: false, reason: 'not-a-url' };
  }

  // https only — blocks http, ws, file, javascript, data, etc.
  if (url.protocol !== 'https:') return { valid: false, reason: 'not-https' };
  if (url.username.length > 0 || url.password.length > 0) {
    return { valid: false, reason: 'has-credentials' };
  }
  if (isInternalHost(url.hostname)) return { valid: false, reason: 'internal-host' };
  // Require a dotted public hostname (rejects bare names and IP-less hosts).
  if (!url.hostname.includes('.')) return { valid: false, reason: 'not-public' };

  return { valid: true, normalized: url.toString() };
}

export function rpcRejectMessage(reason: RpcRejectReason): string {
  switch (reason) {
    case 'empty':
      return 'Enter an RPC endpoint URL, or leave blank to use the default.';
    case 'not-a-url':
      return 'That is not a valid URL.';
    case 'not-https':
      return 'Only https:// endpoints are allowed.';
    case 'has-credentials':
      return 'Endpoint URLs must not contain a username or password.';
    case 'internal-host':
      return 'Local and internal-network addresses are not allowed.';
    case 'not-public':
      return 'Enter a public https endpoint (a domain name, not a bare host).';
  }
}
