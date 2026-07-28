# OMIKAMI WALLET — SECURITY.md

Status: DRAFT — awaiting human review
Date: 2026-07-13

## What OMIKAMI WALLET will never do

- Ask for, display, transmit, log, or store a seed phrase or private key. Anyone or anything asking for your seed phrase "for OMIKAMI WALLET" is an attacker.
- Sign transactions on your behalf. Every signature happens inside your own wallet.
- Take custody of funds at any step.
- Use unlimited ERC-20 approvals by default.
- Approve tokens silently or switch networks without explanation.
- Send your address, balances, transactions, or activity to analytics providers without explicit informed consent (the secure prototype ships with no analytics at all).

## Honest limitations

- No software is unhackable, and we will never claim OMIKAMI WALLET is.
- Portions of this codebase are AI-assisted. AI-generated code is treated as unaudited until independently reviewed, and the project does not reach mainnet until the external review gates in MAINNET_CHECKLIST.md pass.
- Your wallet is the final authority. If what your wallet shows differs from what our interface shows, trust your wallet and reject.
- RPC providers you use can see your IP address and the addresses you query. See PRIVACY.md and DECENTRALIZATION.md.
- A compromised browser or malicious extension can defeat any web interface. Keep your browser clean; prefer hardware wallets.

## Security architecture (summary)

- Client-only application; no server holds user data; no server can sign.
- Read-only public clients for all chain reads; wallet clients only for user-approved actions.
- Every transaction is shown in a human-readable preview before your wallet asks for confirmation.
- OMIKAMI SHIELD risk verdicts are limited to: Verified, Known, Unknown, Suspicious, Blocked by local policy. A heuristic is never presented as a confirmed scam verdict.
- Strict Content Security Policy, no inline scripts, no eval, no remote code execution.
- Exact token approvals by default; the allowance manager lets you review and revoke at any time.
- Mainnet transaction features remain disabled until all 12 gates in MAINNET_CHECKLIST.md pass.

## Reporting a vulnerability

- **Primary channel — GitHub Private Vulnerability Reporting.** On the repository,
  go to the **Security** tab → **Report a vulnerability** (this opens a private
  advisory visible only to the maintainer). This is the preferred route for the
  read-only audit-candidate; it needs no email address to be published.
  Maintainers: enable it once under Settings → Advanced Security → *Private
  vulnerability reporting* → **Enable**.
- If private reporting is unavailable, contact the maintainer privately via their
  GitHub profile (`github.com/Reprisal369`) rather than a public issue.
- **Please do not open public issues for exploitable vulnerabilities.**
- Commitment: acknowledgment within 72 hours, status updates at least weekly, no
  legal action against good-faith research within scope.
- A dedicated security email + PGP key, formal safe-harbor wording, and bounty
  tiers are established before mainnet (MAINNET_CHECKLIST Gate 11). Until then the
  channels above are the live disclosure route for this testnet, read-only build.

## Release integrity

- Reproducible builds; release hashes and IPFS CIDs published with every release (RELEASE_CHECKLIST.md).
- Official domains and CIDs are listed in the repository README. Verify before use; bookmark the official domain.

## Incident response

See INCIDENT_RESPONSE.md (to be authored before Gate 2 completion): severity levels, communication channels, deployment takedown procedure, post-mortem policy.
