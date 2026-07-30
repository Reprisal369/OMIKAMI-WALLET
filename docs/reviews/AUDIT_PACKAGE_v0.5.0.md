# OMIKAMI WALLET — External audit package (v0.5.0)

> **Update:** the current release to review is **`v0.5.1`** (tag `v0.5.1`), which
> applies the internal pre-audit hardening documented in
> `docs/reviews/INTERNAL_PRE_AUDIT_v0.5.0.md`. This package documents the `v0.5.0`
> baseline evidence; the architecture, threat-model mapping, dependency
> inventory, egress, headers, and CI sections all still apply. Reproduce at tag
> `v0.5.1` for the latest code.

Evidence package for an independent security review of the read-only release.
Scope/exclusions: `SECURITY_AUDIT_SCOPE.md`. Reviewer onboarding:
`docs/reviews/EXTERNAL_AUDIT_PREP.md`. Prepared 2026-07-26.

All results below were reproduced from a clean build of the audited commit. No
product code was changed to assemble this package.

---

## 1. Exact audited commit

- **Product-code commit (SHA-256 / git):**
  `760c88f8ed9ad094307adb768e6527f5d099e884`
- **Release / tag:** `v0.5.0` → tag `v0.5.0-readonly-audit-candidate` (points at
  the commit that carries these audit docs; the docs are documentation-only and
  change no product behavior relative to the SHA above).
- **Repository:** `github.com/Reprisal369/OMIKAMI-WALLET` (public, MIT).
- **Toolchain:** pnpm `10.34.5`, Node `>=22` (CI uses 22).

## 2. Architecture overview & trust boundaries

Client-only **static export** (Next.js 16 `output: 'export'`) — no server, no
cookies, no database, no analytics. pnpm monorepo:

- `apps/web` — React 19 UI (the only deployable).
- `packages/security` — pure, unit-tested security logic (no I/O, no key
  material).
- `packages/chain-config` — network registry + `transactionsEnabled` hard gate.
- `packages/token-registry` — reviewed token identities + sanitization.
- `packages/ui`, `packages/types` — presentation + shared types.

**Trust boundaries.**

| Boundary | Trusted? | Control |
|---|---|---|
| User's injected wallet (EIP-1193) | Holds keys; app never sees them | `connectors: [injected()]`, `storage: null` |
| Sepolia / mainnet RPC provider | Untrusted (can lie / see IP+addresses) | Read-only calls; errors sanitized; CSP `connect-src` allowlist; documented in PRIVACY.md |
| On-chain token data (names/symbols) | Untrusted display strings | `sanitizeTokenText`, identity = chainId+EIP-55 address, unknown-token quarantine |
| User-supplied RPC URL (Settings) | Untrusted input | `validateRpcUrl` (https-only, blocks internal ranges) |
| Hosting (Cloudflare Pages) | Serves static assets + headers | SRI-style CSP hashes; reproducible-build manifest to detect tampering |
| The app itself | Cannot move funds | No write/sign path; `transactionsEnabled=false` everywhere |

See `ARCHITECTURE.md` (ADRs) and `THREAT_MODEL.md` for detail.

## 3. Threat model → implementation & tests

| Threat (THREAT_MODEL.md) | Implementation | Tests |
|---|---|---|
| A1/A2 No key/seed/keystore import possible | No such inputs; `scripts/check-forbidden-terms.mjs`; ESLint `no-restricted-*`; `viem/accounts` import banned | forbidden-gate (0); e2e test 15 (no credential surface) |
| Hard read-only gate | `packages/chain-config` `transactionsEnabled:false` (all chains) | `chain-config` unit test; e2e test 15 |
| Address poisoning | `emphasizeAddress`, `isLookalikeAddress`, `validateAddress` (EIP-55) in `packages/security/src/index.ts` | `security` unit tests |
| Fat-finger / dangerous send (preview) | `buildSendPreview`, `parseAmountInput` in `send-preview.ts` (zero-addr, token-contract, self-send, over-balance, decimals) | `send-preview.test.ts` (20) |
| Dangerous allowances | `summarizeApprovals`, `classifyAllowanceRisk`, `isUnlimitedAllowance` in `allowance.ts` | `allowance.test.ts` (11) |
| D3 Never call unknown contracts | Activity + Allowance quarantine unknown tokens; live reads only for registry tokens | `activity.test.ts`; e2e 17/21 |
| F2 No HTML injection | No `dangerouslySetInnerHTML`; plain-text render; sanitizer | forbidden-gate; ESLint |
| Error leakage | `classifyConnectError`/`connectFailureMessage` sanitize provider errors | `security` unit tests; e2e 3/9/10 |
| C1b Malicious user RPC / SSRF / privacy | `validateRpcUrl` in `packages/security/src/rpc.ts` | `rpc.test.ts` (10); e2e 18 |
| A2/privacy No unexpected egress | `scripts/check-bundle.mjs` host allowlist; CSP `connect-src` | bundle-gate; live header check |
| C1c Opt-in storage only | `apps/web/src/lib/rpc-storage.ts` (one key, re-validated) — the only storage exception | forbidden-gate exception is file-scoped; e2e 12 (no wallet storage after refresh) |

## 4. Dependency inventory & SBOM

Runtime dependencies (`apps/web`): `next@16.2.11`, `react@19.2.7`,
`react-dom@19.2.7`, `wagmi@3.7.1`, `viem@2.55.1`,
`@tanstack/react-query@5.101.2`, plus the internal `@omikami/*` workspace
packages.

`pnpm.overrides` (security pins): `postcss>=8.5.10`, `sharp>=0.35.0`,
`brace-expansion>=5.0.8`.

SBOM (`pnpm sbom` → `sbom.json`): **186 components**. License spread:
MIT 143, Apache-2.0 21, ISC 8, BSD-2-Clause 6, BSD-3-Clause 2, MPL-2.0 2,
LGPL-3.0-or-later 1, CC-BY-4.0 1, BlueOak-1.0.0 1, 0BSD 1. The three
non-permissive/attribution licenses (MPL-2.0 = lightningcss; LGPL-3.0 = sharp
native lib; CC-BY-4.0 = caniuse-lite) are **build-time only** and are **not
shipped** in the static export. Lockfile: `pnpm-lock.yaml` (committed, frozen).

## 5. Outbound domains & RPC endpoints (complete)

The running app contacts only:

| Host | Purpose | When |
|---|---|---|
| `https://11155111.rpc.thirdweb.com` | Sepolia RPC (block probe, balances, `eth_getLogs`, allowances) | Connected on Sepolia |
| `https://eth.merkle.io` | Ethereum mainnet default RPC (ENS name lookup; balance only if wallet is on mainnet) | ENS resolution / mainnet |
| Same origin (`*.pages.dev`) | App JS/CSS/icon | Page load |
| Block explorers (`sepolia.etherscan.io` etc.) | `<a>` links only — user-initiated navigation, not fetched | On click |

Verified live in the browser Network panel (2026-07-26): only same-origin +
`11155111.rpc.thirdweb.com` (+ `eth.merkle.io` for ENS). No analytics, no fonts,
no third-party scripts. Matches `PRIVACY.md`, the bundle allowlist, and CSP
`connect-src`.

## 6. Security headers & CSP (as served by Cloudflare Pages)

Generated by `scripts/generate-csp.mjs` (`pnpm csp`) into `apps/web/out/_headers`
at build time. CSP:

```
default-src 'none';
script-src 'self' 'sha256-…'(×12 inline hydration-script hashes);
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self' https://11155111.rpc.thirdweb.com https://eth.merkle.io;
manifest-src 'self'; worker-src 'self';
frame-src 'none'; frame-ancestors 'none';
base-uri 'none'; form-action 'none'; object-src 'none';
upgrade-insecure-requests
```

Additional headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer`, a locked-down `Permissions-Policy`,
`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy:
same-origin`, `Cross-Origin-Embedder-Policy: require-corp`,
`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
Confirmed live in the response headers on 2026-07-26; no CSP violations in the
console during connect/balance/activity/allowance/preview flows. Rationale and
per-host variants: `SECURITY_HEADERS.md`. Known caveat: a user-set custom RPC
(Settings) is blocked by the strict `connect-src` by design (documented).

## 7. CI workflow & branch-protection evidence

`.github/workflows/ci.yml` — every third-party action pinned to a full commit
SHA (verified via `git ls-remote`):

- `actions/checkout@d23441a…` (v6.1.0)
- `actions/setup-node@2499707…` (v6.5.0)
- `actions/upload-artifact@330a01c…` (v5.0.0)
- `actions/dependency-review-action@2031cfc…` (v4.9.0)
- `google/osv-scanner-action/osv-scanner-action@9a49870…` (v2.3.8)
- `gitleaks/gitleaks-action@ff98106…` (v2.3.9)

Jobs on push/PR: `verify` (lint · typecheck · typecheck:e2e · unit · forbidden ·
secrets · build · bundle · audit), `e2e` (Playwright, all 38), `sbom-and-hash`
(SBOM + CSP + reproducible manifest), `osv-scan`, `secret-scan`, and
`dependency-review` (PR only). Least-privilege `permissions: contents: read`;
concurrency cancel-in-progress.

**Branch protection** (ruleset `protect-main`, Active, targets default branch
`main`): require a pull request (0 approvals) · require status checks
`verify, e2e, sbom-and-hash, osv-scan, secret-scan` + branches up to date · block
force pushes · restrict deletions. Dependency graph + Dependabot alerts enabled.
Evidence: CI green on push and on PR #1/#2 (all required checks passed);
`GITHUB_SETUP.md` documents the exact configuration.

## 8. Latest results (clean build of the audited commit, 2026-07-26)

| Gate | Result |
|---|---|
| Unit tests | **85 passed** (chain-config 7, security 68, token-registry 10) |
| ESLint (incl. security bans) | PASS |
| TypeScript strict (all packages + e2e) | PASS |
| Forbidden-pattern gate | PASS (0 violations) |
| Secret gate | PASS (0 findings) |
| Production build (static export) | PASS |
| Bundle allowlist gate | PASS (37 files, 0 unknown hosts, 0 sourcemaps) |
| Dependency audit (`pnpm audit`) | PASS (0 vulnerabilities) |
| SBOM generation | PASS (186 components) |
| Playwright e2e (owner machine) | **38 passed** (desktop + mobile) |

## 9. Known limitations & residual risks

1. **Not byte-reproducible yet.** Next 16 Turbopack ignores `generateBuildId`;
   two independent rebuilds differ. `release-hash` still detects tampering of a
   *published* build. Full determinism is a pre-mainnet item (Gate 8).
2. **CSP delivery is host-dependent.** IPFS gateways cannot deliver
   `frame-ancestors`/HSTS (see `SECURITY_HEADERS.md`).
3. **Custom RPC vs strict CSP** are mutually exclusive without widening
   `connect-src` — a documented trade-off.
4. **RPC provider trust.** A malicious/compromised RPC can return false read
   data or log the user's IP + queried addresses. Mitigated by user-configurable
   endpoints + explicit UI warning; not eliminable for a client that reads
   chain data.
5. **Library contains write capability.** viem (a full wallet library) bundles
   strings like `eth_sendRawTransaction`/`wallet_switchEthereumChain`. These have
   **no reachable path** in this app; the control is runtime reachability, not
   string absence (see §12 and the highest-risk file list).
6. **`connectTimeout` is a UI hint**, not a hard abort; acceptable read-only.

## 10. Reproduction instructions

```bash
git clone https://github.com/Reprisal369/OMIKAMI-WALLET
cd OMIKAMI-WALLET
git checkout 760c88f8ed9ad094307adb768e6527f5d099e884
corepack enable
pnpm install --frozen-lockfile
pnpm verify        # lint · typecheck · typecheck:e2e · unit · forbidden · secrets · build · bundle · audit
pnpm e2e           # 38 Playwright tests (installs Chromium)
pnpm sbom          # sbom.json
pnpm build && pnpm csp   # static export + generated _headers (CSP)
OMIKAMI_BUILD_ID=760c88f8ed9ad094307adb768e6527f5d099e884 pnpm release:hash
```

Static output is `apps/web/out/`. Serve it with any static file server (headers
come from `apps/web/out/_headers` on Cloudflare Pages / Netlify).

## 11. Manual test accounts & Sepolia procedure

- **No credentials are provided or required.** The reviewer uses their own
  injected wallet (MetaMask/Rabby/Coinbase extension) — the app never receives
  keys.
- Set the wallet to **Ethereum Sepolia** (chain 11155111). Fund with any Sepolia
  faucet (e.g. Google Cloud Web3 faucet). Optional: acquire Sepolia **USDC**
  (registry token `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`, 6 decimals) to
  exercise token/allowance/activity panels.
- Manual test pass (matches the shipped e2e):
  1. Load site → panels render, no console/CSP errors.
  2. Connect on Sepolia → checksummed address, native balance, USDC balance.
  3. Activity + Allowance panels load (empty or populated).
  4. Transfer **preview**: enter a recipient + amount → SHIELD checks appear;
     confirm there is **no** send/sign control.
  5. Settings: reject `http://`/localhost/private-IP RPC; accept a public https.
  6. Switch wallet to **mainnet** → wrong-network warning, no auto-switch,
     balance read fails gracefully (no fabricated data).
  7. Reload → nothing persists (no wallet storage keys).

## 12. Read-only confirmation

Confirmed on the audited commit (source + built bundle + live runtime):

- **Stores no keys / signs nothing.** No seed/private-key/keystore import exists.
  `connectors: [injected()]`, `storage: null`. All signing happens inside the
  user's wallet, which this build never asks to sign.
- **No reachable write/sign/switch path.** Source uses only read hooks
  (`useAccount`, `useBalance`, `useReadContract(s)`, `usePublicClient`,
  `useBlockNumber`, `useEnsName`, `useConnect`, `useDisconnect`). No
  `useSendTransaction`/`useWriteContract`/`useSignMessage`/`useSwitchChain` and
  no `.sendTransaction/.writeContract/.signMessage/.switchChain` calls anywhere.
- **`transactionsEnabled` is false for every chain**, enforced by unit test and
  surfaced by the SHIELD panel (escalates to a blocking warning if ever true).
- The header nav items "Send/Receive/Swap" are **disabled `<span aria-disabled>`
  labels** ("Available in a later phase"), not links or buttons.

## 13. Highest-risk files for manual review

Ranked by security impact:

1. `apps/web/src/lib/wagmi.ts` — connector set, transport, `storage: null`; the
   single extension point where a future write capability could be introduced.
2. `packages/chain-config/src/index.ts` — the `transactionsEnabled` hard gate and
   network allowlist.
3. `packages/security/src/rpc.ts` — `validateRpcUrl` (SSRF/privacy boundary for
   user-supplied endpoints).
4. `apps/web/src/lib/rpc-storage.ts` — the ONLY sanctioned browser-storage use.
5. `packages/security/src/send-preview.ts` — dangerous-send heuristics (must stay
   preview-only; `signingAvailable` is a literal `false`).
6. `packages/security/src/allowance.ts` + `AllowanceDashboardPanel.tsx` —
   unknown-contract quarantine (D3): confirm unknown tokens are never called.
7. `packages/token-registry/src/index.ts` — token identity + `sanitizeTokenText`
   (untrusted on-chain string handling).
8. `packages/security/src/index.ts` — address validation + error sanitization.
9. `scripts/check-forbidden-terms.mjs`, `check-bundle.mjs`, `check-secrets.mjs`,
   `generate-csp.mjs` — the enforcement gates themselves.
10. `.github/workflows/ci.yml` — change-control integrity (action pinning).
