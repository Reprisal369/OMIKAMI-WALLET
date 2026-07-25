# OMIKAMI WALLET — PRIVACY.md

Date: 2026-07-13 · Scope: phase-one read-only build.

## Principles

No analytics, no tracking scripts, no fingerprinting, no session replay, no remote fonts, no advertising. Nothing about your wallet is stored after the tab closes (`storage: null`); local persistence, if ever offered, will be explicit opt-in in Settings.

## Complete inventory of external requests

1. **Sepolia RPC (viem default public endpoint, chain 11155111)** — block-number probe (30-second interval) and native balance reads. The RPC operator can see your IP address and the addresses you query. This is inherent to any RPC-based wallet interface; you may run your own node and use it via user-configurable endpoints (planned phase 2) to remove this exposure.
2. **Mainnet RPC (viem default, chain 1)** — used for ENS name resolution of your connected address (ENS lives on mainnet), and for a balance read only if your wallet is connected to mainnet. App features remain Sepolia-only.
3. **Your injected wallet (EIP-1193)** — local browser messaging, not a network request.
4. **Block-explorer links** — plain links that open only when you click them; the explorer then sees a normal page visit.

Nothing else. This list is enforced by an automated bundle gate (`scripts/check-bundle.mjs`): a build fails if it references any hostname outside the reviewed allowlist. Changes to this inventory require updating this document in the same PR.

## What we never do

Transmit or store seed phrases or private keys (no such input exists); send wallet addresses, balances, transactions, or browsing activity to analytics providers; load third-party scripts; use cookies (there is no server).

## Error handling

Error messages shown in the interface are generated locally and never include raw provider payloads. There is no remote error-reporting service.

## Development-machine note

Next.js build telemetry is disabled for this project (`next telemetry disable`). This concerns the developer's machine only, never users.
