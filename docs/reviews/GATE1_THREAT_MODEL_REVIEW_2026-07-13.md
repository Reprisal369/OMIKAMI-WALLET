# Gate 1 — Owner review of THREAT_MODEL.md sections A, B, C, F

Reviewer: project owner · Date: 2026-07-13 · Scope: sections A, B, C, F (phase-one relevant)

## Verdict

**Conditionally approved for the strictly read-only phase one.** Not marked "fully approved": a threat model describes promised controls; only inspection of source, CI configuration, hosting settings, and tests proves the controls exist. Overall score on the visible text: 8/10.

Scores: A (key material) 8.25 · B (supply chain/build) 7.3 · C (RPC/data integrity) 8.2 · F (application/web) 8.2.

Top residual risks named by reviewer: (1) compromised dependency, (2) hacked deployment/hosting/DNS account, (3) phishing clone, (4) malicious browser extension, (5) gap between documented promises and actual code.

## Phase-one approval conditions (all must hold)

| Condition | Status at review |
|---|---|
| No send / approve / permit / message signing / swaps / bridge / staking / contract deployment | HOLDS — no code path exists; `transactionsEnabled=false` + unit test |
| No seed phrase or private-key import of any kind | HOLDS — no credential input exists; EIP-1193 connectors only |
| Sepolia only during development | HOLDS — chain-config enables Sepolia only; mainnet named-but-disabled |
| No production publication before independent code and deployment review | HOLDS — nothing deployed; reaffirmed as a hard rule |

## Honest implementation status of promised controls (at review date)

Implemented and verified: no credential inputs; read-only invariant with test; storage: null; sanitized errors; pinned lockfile; postinstall scripts blocked; pnpm audit clean; manual forbidden-term and bundle-endpoint scans (this session).
Promised but NOT yet implemented: CI pipeline (all automated scans), CSP production headers, e2e tests, secret scanning, SBOM, second vulnerability scanner, signed releases/attestation, monitoring. These remain OPEN and are tracked below.

## Hardening backlog from this review (must be implemented, then re-verified)

### A — key material
- [ ] Detection beyond keyword scans: flag new textarea/password fields; forms with 12/15/18/21/24 word patterns; outbound requests from sensitive screens; dynamic imports/external scripts; QR-scanner/file-upload/keystore-import surfaces; new routes and modals.
- [ ] Ban `privateKeyToAccount`, `mnemonicToAccount`, `HDKey` (and similar) in production code via lint/CI rule.
- [ ] Ban localStorage/sessionStorage/IndexedDB for sensitive data (lint/CI rule).
- [ ] Scan BUILT bundles, not only source; check sourcemaps for secrets; disable or protect production sourcemaps.
- [ ] Secret scanning on commits and PRs.
- [ ] Assert error messages never log full provider responses.

### B — supply chain and build
- [ ] SBOM per release; OSV-Scanner (or equivalent) as second scanner; dependency review on every PR.
- [ ] Auto-block unexpected lockfile changes; maintainer/registry allowlist; dependency-confusion and typosquatting checks; no git URLs/local paths/tarballs in package files; lifecycle scripts disabled by default with explicit exceptions; periodic pruning of unused dependencies.
- [ ] CI hardening: hardware security keys mandatory for repo/hosting/DNS accounts; no long-lived cloud credentials (OIDC); Actions pinned to full commit SHAs; separated build/deploy jobs; environment protection + manual production approval; artifact signing; SLSA-style provenance attestation; fork-PR secret protection; audit-log retention and review; admin-proof branch protection.
- [ ] Deployment/DNS: registry lock; ≥2 admins, no shared accounts; separate registrar/DNS/hosting; Certificate Transparency + DNS/nameserver/TLS monitoring; deployments only from CI; automatic rollback on hash mismatch; signed release manifest; predefined out-of-band emergency channels; no single-person recovery dependency. SMS-2FA explicitly insufficient.

### C — RPC and data integrity
- [ ] Quorum policy for critical reads; compare block number + block hash; maximum allowed block lag; chain-ID-bound results and chain-change detection; explorer cross-check for exceptional cases; no transaction decision from a single RPC; clear degraded mode on disagreement; RPC-URL validation against localhost/internal networks/dangerous schemes; verify true provider independence (not shared infrastructure).
- [ ] Provider loss: signed remote provider config only; local fallback list; exponential retry with limits; circuit breaker per provider; stale-marked cache of non-sensitive data; independent status page; no silent switch to unknown RPC; health checks without sending wallet addresses where avoidable.
- [ ] Prices (pre-swap-phase requirement): median of multiple independent sources; stale-price detection; timestamp + source displayed; liquidity/volume bounds; deviation warnings; never use USD value for security decisions; "price unknown" state; swap quote/minimum-received/price-impact shown directly.

### F — application and web
- [ ] Phishing: one short primary domain; registrar lock; CT + typosquat monitoring; pinned official links on social profiles; signed release info; no search ads as primary access; current domain shown in in-app security copy.
- [ ] XSS/CSP: production CSP without unsafe-inline/unsafe-eval, nonces or hashes, object-src 'none', base-uri 'none', form-action 'none'/strict, connect-src allowlist; Trusted Types where supported; safe handling of SVG/data-URLs/ENS avatars; protocol allowlist for links (https + vetted schemes); no HTML from token metadata; sanitizer configured AND tested.
- [ ] Clickjacking: frame-ancestors 'none' as real HTTP header on every route and error page + X-Frame-Options: DENY; verify hosting/CDN/IPFS gateway does not strip headers.
- [ ] CSRF: standing rule — any future server mutation triggers a new threat-model review (SameSite, CSRF tokens, origin validation, no state-changing GET).
- [ ] Logging/privacy: secret scanning of repo AND built bundle; no wallet addresses/balances/ENS/tx data in error output; redaction in any error tracking; CSP connect-src as enforceable outbound allowlist; periodic network review; no session-replay software; any future frontend "API key" treated as public and restricted by domain/quota/scope.
- [ ] Extensions: re-display chain ID, contract, recipient, amount immediately before any request; safe handling of accountsChanged/chainChanged (halt on unexpected change); no auto-resubmit; duplicate-request prevention; unknown providers never trusted; hardware-wallet recommendation for large amounts; wallet popup framed as final checkpoint without implying every popup is trustworthy.

## Process consequence

Every item above enters the tracked backlog. Gate 1 for transaction features (phase 3+) additionally requires an implementation-verification pass: source, CI configuration, hosting settings, and tests inspected against this document.
