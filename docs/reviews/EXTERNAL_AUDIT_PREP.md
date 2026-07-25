# OMIKAMI WALLET — External review preparation

Prepared 2026-07-25 · Version **v0.5.0** · Status: read-only, testnet-only, not
deployed.

This is the packet to hand an independent reviewer (application-security /
web3-frontend). It defines scope, points to the code that matters, and states
what is deliberately out of scope for this phase. It is NOT a claim that the app
is audited — it is the input to that audit.

## 1. One-paragraph description

OMIKAMI WALLET is a non-custodial, open-source, **read-only** Ethereum wallet and
DeFi dashboard, currently on the Sepolia testnet. It connects to an injected
browser wallet (EIP-1193/EIP-6963), reads balances, token balances, recent
ERC-20 activity, and ERC-20 allowances, and offers a **preview-only** transfer
screen. It never holds keys, never signs, and never broadcasts. There is no
seed-phrase / private-key / keystore import path anywhere by design.

## 2. What to review (in scope)

Primary security surface, in priority order:

1. **The read-only invariant.** Confirm no code path can sign, send, approve,
   permit, swap, bridge, stake, or deploy. Entry points:
   - `packages/chain-config` — `transactionsEnabled` is false for every chain
     (unit-tested).
   - `apps/web/src/lib/wagmi.ts` — `connectors: [injected()]`, `storage: null`.
   - `apps/web/src/app/providers.tsx` — `reconnectOnMount={false}`.
   - Gates: `scripts/check-forbidden-terms.mjs` (bans key-material APIs, browser
     storage, HTML injection, credential inputs, keystore, eval) and the ESLint
     `no-restricted-*` rules in the flat config.
2. **Address / input handling (anti-poisoning, anti-fat-finger).**
   - `packages/security/src/index.ts` — `validateAddress` (EIP-55),
     `emphasizeAddress`, `isLookalikeAddress`.
   - `packages/security/src/send-preview.ts` — `buildSendPreview`,
     `parseAmountInput` (integer-only, no floating point).
   - `packages/security/src/allowance.ts` — `summarizeApprovals`,
     `classifyAllowanceRisk`, `isUnlimitedAllowance`.
3. **Untrusted on-chain data rendering (no injection, no unknown-contract
   calls).**
   - `packages/token-registry/src/index.ts` — `sanitizeTokenText`, EIP-55
     registry schema, evidence requirement.
   - `apps/web/src/components/ActivityPanel.tsx` and
     `AllowanceDashboardPanel.tsx` — quarantine of unknown token contracts;
     confirm unknown contracts are never called (THREAT_MODEL D3).
4. **Network egress & privacy.**
   - `packages/security/src/rpc.ts` — `validateRpcUrl` (https-only; rejects
     credentials, localhost, private / loopback / link-local / CGNAT, IPv6
     literals, bare hosts). Consumed by `SettingsPanel.tsx` and `rpc-storage.ts`.
   - `scripts/check-bundle.mjs` — build-time host allowlist.
   - `PRIVACY.md` — the complete external-request inventory. Confirm the running
     app contacts only those hosts, and that `connect-src` in
     `SECURITY_HEADERS.md` matches.
5. **Opt-in browser storage.** `apps/web/src/lib/rpc-storage.ts` is the ONLY
   module permitted to use `localStorage` (single key, re-validated on read),
   with scoped ESLint + forbidden-gate exceptions. Confirm nothing else stores
   anything.
6. **Supply chain & build integrity.** `pnpm-lock.yaml`, `pnpm.overrides`,
   `scripts/generate-sbom.mjs`, `scripts/release-hash.mjs`, `.github/workflows/
   ci.yml` (actions pinned to SHAs).
7. **Security headers.** `scripts/generate-csp.mjs` + `SECURITY_HEADERS.md`
   (hash-based CSP for the static export; custom-RPC trade-off).

## 3. Architecture summary

- pnpm workspace monorepo. `apps/web` is a Next.js 16 **static export**
  (`output: 'export'`) — no server, no cookies, no database, no analytics.
- Internal packages: `types`, `chain-config`, `security`, `token-registry`,
  `ui`. Security logic is **pure functions** with unit tests, deliberately
  isolated from the React layer.
- Stack: React 19, wagmi 3 / viem 2, TanStack Query, Zod, Tailwind 4. Full
  rationale in `ARCHITECTURE.md` (§8 ADRs) and `THREAT_MODEL.md`.

## 4. How to build, test, and reproduce

```
corepack enable
pnpm install --frozen-lockfile
pnpm verify        # lint, typecheck, typecheck:e2e, unit, forbidden, secrets, build, bundle, audit
pnpm e2e           # 38 Playwright tests (desktop + mobile), needs Chromium
pnpm sbom          # SBOM
pnpm build && pnpm csp        # static export + generated _headers (CSP)
OMIKAMI_BUILD_ID=<git-sha> pnpm release:hash   # build manifest hash
```

Current local results (2026-07-25): unit **85/85**, e2e **38/38**, `pnpm audit`
**0**, bundle gate clean (34 files, 0 unknown hosts, 0 sourcemaps).

## 5. Known limitations (already documented, not findings)

- **Not byte-reproducible yet.** Next 16 Turbopack ignores `generateBuildId`; two
  independent rebuilds are not byte-identical. `release-hash` still detects
  tampering of a *published* build. Full determinism is a pre-mainnet item
  (RELEASE_CHECKLIST Gate 8).
- **CSP delivery depends on host.** Static export cannot emit headers; IPFS
  gateways cannot deliver `frame-ancestors`/HSTS (see SECURITY_HEADERS.md).
- **Custom RPC + strict CSP** are mutually exclusive without widening
  `connect-src` (documented trade-off).
- **CI not yet active / repo not yet on GitHub** at time of writing (workflow is
  written and SHA-pinned; see GITHUB_SETUP.md).

## 6. Explicitly OUT of scope for this review

- Transaction, approval, signing, swap, bridge, and staking flows — **they do
  not exist yet**. They must get their own threat-model sign-off and a separate
  review before implementation.
- Smart-contract audit — there are no first-party contracts in this phase.
- Mainnet deployment — gated on `MAINNET_CHECKLIST.md`.

## 7. Reference documents

`THREAT_MODEL.md`, `SECURITY.md`, `PRIVACY.md`, `ARCHITECTURE.md`,
`DECENTRALIZATION.md`, `DEPENDENCY_POLICY.md`, `INCIDENT_RESPONSE.md`,
`RELEASE_CHECKLIST.md`, `SECURITY_HEADERS.md`, `GITHUB_SETUP.md`, `CHANGELOG.md`,
`PROJECT_STATE.md`, and the prior owner review in
`docs/reviews/GATE1_THREAT_MODEL_REVIEW_2026-07-13.md`.

## 8. Suggested reviewer deliverable

Findings by severity (critical/high/medium/low/info) with concrete file+line
references and reproduction steps; an explicit statement on whether the
read-only invariant holds; and a go/no-go for beginning the transaction phase.
