# OMIKAMI WALLET — SECURITY_AUDIT_SCOPE.md

Defines what an external security review of this release covers and what it does
not. Companion to `docs/reviews/AUDIT_PACKAGE_v0.5.0.md` (the evidence package)
and `docs/reviews/EXTERNAL_AUDIT_PREP.md` (the reviewer onboarding).

- **Product:** OMIKAMI WALLET — non-custodial, open-source, read-only Ethereum
  wallet & DeFi dashboard.
- **Release under review:** `v0.5.1` (tag `v0.5.1`) — the read-only audit
  candidate after the internal pre-audit hardening. (The prior tag
  `v0.5.0-readonly-audit-candidate` is the pre-hardening baseline.)
- **Audited product-code commit:** `c32d255` (tag `v0.5.1`). Baseline before
  hardening was `760c88f8ed9ad094307adb768e6527f5d099e884`; the delta is
  documented in `docs/reviews/INTERNAL_PRE_AUDIT_v0.5.0.md`.
- **Network:** Ethereum Sepolia (testnet) only. No mainnet transactions.
- **Deployment under review:** static export hosted on Cloudflare Pages
  (`https://omikami-wallet.pages.dev`) — a preview, not an announced launch.

## In scope

1. The **read-only invariant**: verify no code path can sign, send, approve,
   permit, swap, bridge, stake, deploy, or switch networks.
2. **Client application** (`apps/web`): wallet connect flow, portfolio/token
   reads, activity, allowance dashboard, transfer PREVIEW, settings/RPC input.
3. **Security library** (`packages/security`): address validation, poisoning
   heuristics, error hygiene, RPC-URL validation, send-preview and allowance
   pure logic.
4. **Token registry** (`packages/token-registry`): identity model, sanitization,
   evidence requirement.
5. **Chain config** (`packages/chain-config`): the `transactionsEnabled` hard
   gate and network allowlist.
6. **Supply chain & build integrity**: `pnpm-lock.yaml`, `pnpm.overrides`, SBOM,
   reproducible-build manifest, CI pinning.
7. **Network egress / privacy**: the complete outbound-host inventory and its
   enforcement (bundle allowlist gate + CSP `connect-src`).
8. **Security headers / CSP** as generated for and served by the host.
9. **CI & branch protection** as the change-control mechanism.
10. **Documentation accuracy**: whether the claims in this repo match the code.

## Out of scope (deliberately, for this phase)

1. **Transaction, approval, signing, swap, bridge, staking flows** — they do not
   exist in this release. They must receive their own threat model and a
   separate review before implementation.
2. **Smart-contract audit** — there are no first-party contracts in this phase.
3. **Mainnet deployment / production launch** — gated by `MAINNET_CHECKLIST.md`.
4. **Third-party infrastructure internals** — the security of MetaMask/Rabby/
   Coinbase Wallet, the public Sepolia/mainnet RPC providers
   (`11155111.rpc.thirdweb.com`, `eth.merkle.io`), Cloudflare Pages, and GitHub
   themselves. We assess how we *use* them, not their internal security.
5. **Analytics / telemetry** — none is present; there is nothing to review.
6. **Automatic dependency updates (Dependabot version bumps)** — intentionally
   not enabled for this release (see "Dependency policy" below).
7. **Availability / DoS of public RPC endpoints** — outside our control;
   degradation is handled gracefully (documented).

## Constraints honored in preparing this package

No product code, dependencies, transaction functionality, mainnet support,
analytics, or automatic dependency updates were added while assembling this
package. Changes were limited to documentation and a favicon asset; product
behavior is unchanged from the audited commit.

## Dependency policy for the review window

Dependencies are **frozen** during the review. Any security-critical bump is
applied manually via a reviewed pull request and recorded in
`DEPENDENCY_POLICY.md`. Automatic version-update PRs (Dependabot) are **off** and
will only be introduced later under these rules: no auto-merge; updates via pull
requests only; all security gates required to pass; lockfile changes reviewed by
hand; major-version updates handled individually.

## Reviewer deliverable requested

Findings by severity (critical/high/medium/low/info) with file+line references
and reproduction steps; an explicit statement on whether the read-only invariant
holds; and a go/no-go recommendation for beginning the transaction phase.
