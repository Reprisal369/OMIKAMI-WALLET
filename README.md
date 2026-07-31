# OMIKAMI WALLET

Non-custodial, open-source Ethereum wallet & DeFi dashboard. **Read-only, on the
Ethereum Sepolia testnet.**

OMIKAMI WALLET never asks for a seed phrase or private key, never signs on your
behalf, and never takes custody of funds — all signing happens inside your own
wallet. This build additionally has **all transaction features disabled**: no
sending, no approvals, no permits, no swaps, no bridges, no staking, no message
signing, no mainnet.

**Live preview:** https://omikami-wallet.pages.dev — read-only, Sepolia only.
Connect any injected wallet (MetaMask / Rabby / Coinbase Wallet extension).

## Status

**Frozen at `v0.5.2` (read-only audit candidate), prepared for an external
security review.** An internal pre-audit has been completed and its hardening
applied (`docs/reviews/INTERNAL_PRE_AUDIT_v0.5.0.md`); dependencies are current
and the app's RPC egress is pinned. No transaction
functionality will be added until the external review is complete and its
findings are resolved. See `PROJECT_STATE.md` for the exact current state and
`CHANGELOG.md` for the version history.

## What it does (all read-only)

- Connect an injected wallet (EIP-1193 / EIP-6963), with checksummed,
  poisoning-aware address display
- Native + verified ERC-20 balances (Sepolia USDC); user-configurable RPC endpoint
- ENS name display
- Recent ERC-20 activity via `eth_getLogs`, with unknown-token quarantine
- Allowance dashboard: spender, current allowance, unlimited-allowance warning,
  risk badge, verification source
- Transfer **preview** with OMIKAMI SHIELD checks — signing is disabled build-wide
- OMIKAMI SHIELD security-status panel

## Run locally

Requirements: Node >= 22, pnpm 10.

```bash
pnpm install
pnpm --filter @omikami/web dev
# open http://localhost:3000
```

Checks:

```bash
pnpm verify   # lint · typecheck · typecheck:e2e · unit · forbidden · secrets · build · bundle · audit
pnpm e2e      # Playwright end-to-end (desktop + mobile)
```

Latest results (clean build): unit **93** · e2e **38** · `pnpm audit` **0
vulnerabilities** · forbidden-pattern, secret and bundle gates clean.

## Security

Read `SECURITY.md` before reporting anything, and report vulnerabilities privately
via the repository **Security** tab (GitHub Private Vulnerability Reporting) — not
public issues. Key promises: no seed phrases, no private keys, no custody, no
analytics, and no transaction/signing path of any kind in this phase.

External reviewers: start with `SECURITY_AUDIT_SCOPE.md` and
`docs/reviews/REVIEWER_HANDOFF.md`.

## Documentation

- Overview & plan: `PROJECT_PLAN.md` · `ARCHITECTURE.md` · `PROJECT_STATE.md` · `CHANGELOG.md`
- Security: `SECURITY.md` · `THREAT_MODEL.md` · `PRIVACY.md` · `SECURITY_HEADERS.md` · `INCIDENT_RESPONSE.md`
- Audit: `SECURITY_AUDIT_SCOPE.md` · `docs/reviews/AUDIT_PACKAGE_v0.5.0.md` · `docs/reviews/EXTERNAL_AUDIT_PREP.md` · `docs/reviews/REVIEWER_HANDOFF.md`
- Process: `CONTRIBUTING.md` · `DEPENDENCY_POLICY.md` · `RELEASE_CHECKLIST.md` · `GITHUB_SETUP.md`
- Decentralization & mainnet gates: `DECENTRALIZATION.md` · `MAINNET_CHECKLIST.md`
- Future design (not implemented): `docs/design/PHASE_2_TRANSACTIONS.md` — the
  transaction phase design & threat model (kept read-only until the audit passes)

## License

[MIT](LICENSE).
