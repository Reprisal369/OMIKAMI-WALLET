# OMIKAMI WALLET

Non-custodial Ethereum wallet dashboard. **Read-only phase-one preview on Ethereum Sepolia (testnet).**

OMIKAMI WALLET never asks for a seed phrase or private key, never signs on your behalf, and never takes custody of funds. All signing happens inside your own wallet. This build additionally has **all transaction features disabled**: no sending, no approvals, no swaps, no message signing.

## Status

Phase one read-only shell. See `PROJECT_STATE.md` for exact current status, `PROJECT_PLAN.md` for the roadmap, and `MAINNET_CHECKLIST.md` for the 12 gates required before any mainnet feature is enabled.

## Run locally

Requirements: Node >= 22, pnpm 10.

```bash
pnpm install
pnpm --filter @omikami/web dev
# open http://localhost:3000
```

Checks:

```bash
pnpm lint        # ESLint
pnpm typecheck   # strict TypeScript across all packages
pnpm test        # unit tests (vitest)
pnpm build       # production build (static export in apps/web/out)
pnpm audit       # dependency audit (pnpm audit)
```

## Security

Read `SECURITY.md` before reporting anything. Key promises: no seed phrases, no private keys, no custody, no analytics, no unlimited approvals by default (approvals are entirely disabled in this phase).

## Documentation

`PROJECT_PLAN.md` · `ARCHITECTURE.md` · `THREAT_MODEL.md` · `SECURITY.md` · `DECENTRALIZATION.md` · `MAINNET_CHECKLIST.md` · `PROJECT_STATE.md`

## Licence

Not yet chosen (human decision pending — see PROJECT_PLAN.md assumption A3).
