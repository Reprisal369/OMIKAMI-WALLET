# OMIKAMI WALLET — THREAT_MODEL.md

Status: CONDITIONALLY APPROVED for the strictly read-only phase one (owner review 2026-07-13, sections A/B/C/F, overall 8/10 — see docs/reviews/GATE1_THREAT_MODEL_REVIEW_2026-07-13.md).
Full approval requires implementation verification: source, CI configuration, hosting settings, and tests inspected against this document. Documented controls are PROMISES until that verification passes.
Date: 2026-07-13 (reviewed)

Format per threat: **Path** (attack path) · **Impact** · **Prevent** (preventive controls) · **Detect** · **Recover** · **Residual** (remaining risk) · **Test** (testing method).

Baseline architectural fact used throughout: OMIKAMI WALLET never possesses keys or funds. The worst cases are therefore (a) tricking the user into signing something harmful, and (b) showing the user false information. Most controls target those two outcomes.

---

## A. Key material

### A1. Seed phrase theft
- Path: Attacker adds a seed-phrase input to the UI (malicious PR, compromised build, phishing clone) and exfiltrates entries.
- Impact: Total loss of user funds.
- Prevent: No seed phrase, private key, keystore file, JSON wallet, or recovery phrase import exists anywhere in the application; the application architecture makes credential import impossible by design (wallet access is exclusively via EIP-1193 connectors). Lint rule + code review reject any input field or string mentioning seed/mnemonic/private key/keystore; SECURITY.md states the app never asks; prominent in-app notice on the Security page.
- Detect: CI grep gate for mnemonic-related terms in UI code; community review of open-source diffs; reproducible-build hash mismatch reveals tampered deployments.
- Recover: Incident response (INCIDENT_RESPONSE.md): public warning, takedown of compromised deployment, post-mortem.
- Residual: Phishing clones outside our infrastructure (see F1).
- Test: Static scan in CI; e2e assertion that no route renders a seed input.

### A2. Private-key exposure
- Path: A dependency or code path reads keys from an injected provider (not possible via standard EIP-1193), or a developer adds key handling for "testing".
- Impact: Total loss for affected users.
- Prevent: EIP-1193/wagmi only; no raw key APIs in the codebase; dependency policy forbids packages that accept private keys in the frontend; `.env` never contains keys; review checklist item on every PR.
- Detect: Dependency audit; CI scan for `privateKey` usage outside viem type imports.
- Recover: Same as A1.
- Residual: User's own wallet software may be compromised — out of our control; we document it.
- Test: CI static scan; unit test asserting wagmi config contains no local-account signers.

## B. Supply chain and build

### B1. Malicious dependencies / supply-chain attack
- Path: Typosquatted or hijacked npm package exfiltrates addresses or mutates transaction data before preview.
- Impact: Wrong recipient/amounts signed; privacy leak.
- Prevent: Minimal dependency set; exact pinned versions; committed lockfile; `--frozen-lockfile` installs; DEPENDENCY_POLICY.md review for every addition/update; no postinstall scripts where avoidable (`pnpm` config); provenance/signature checks where the registry supports them.
- Detect: `pnpm audit` + review of lockfile diffs in every PR; reproducible build hash comparison.
- Recover: Pin to last known-good lockfile; rotate deployment; disclose.
- Residual: Zero-day compromise of a legitimate pinned version. Mitigated by preview always showing viem-decoded data at the last step.
- Test: CI lockfile-diff gate; periodic audit job.

### B2. Compromised build pipeline
- Path: CI secrets or runner compromised; attacker injects code into release artifacts.
- Impact: Malicious production frontend at the legitimate domain.
- Prevent: Reproducible builds; minimal CI permissions; protected branches; signed release tags; two-person release rule (RELEASE_CHECKLIST.md).
- Detect: Published release hashes let anyone rebuild and compare; monitoring of deployed bundle hash.
- Recover: Revoke CI credentials, redeploy from clean environment, publish incident report.
- Residual: Window between deployment and detection.
- Test: Scripted rebuild-and-compare check in scripts/.

### B3. Compromised frontend deployment / DNS hijacking
- Path: Hosting account or DNS registrar compromised; users served a hostile bundle.
- Impact: Users tricked into malicious signatures.
- Prevent: Registrar/hosting 2FA + hardware keys; DNSSEC where supported; IPFS mirror with published CID as a censorship/tamper-resistant alternative; documented official domains.
- Detect: External uptime/content monitoring comparing served hash to release hash.
- Recover: DNS restore, public warning through out-of-band channels, INCIDENT_RESPONSE.md.
- Residual: Users who ignore warnings during the compromise window.
- Test: Monitoring alert drill (manual, pre-mainnet).

## C. RPC and data integrity

### C1. RPC manipulation
- Path: Malicious/compromised RPC returns false balances, false simulation results, or censors transactions.
- Impact: User decisions based on false data; hidden risk in previews.
- Prevent: Multiple independent RPC providers with fallback; user-configurable endpoints; security-relevant reads (e.g., allowance before approval) cross-checked against a second provider when configured; simulation results labelled with their source.
- Detect: Cross-provider disagreement warnings; timeout/error telemetry shown locally to the user.
- Recover: User switches provider; we rotate defaults.
- Residual: All configured providers colluding — documented in DECENTRALIZATION.md.
- Test: Integration tests with mocked conflicting RPC responses.

### C1b. Malicious user-supplied RPC endpoint (added 2026-07-13, phase 2b)
- Path: User pastes (or is socially engineered into pasting) an RPC URL that lies about chain state, harvests IP + queried addresses, or points at an internal/loopback address (SSRF-style probing from the user's machine).
- Impact: False balances/activity shown; privacy leak to a hostile endpoint; scanning of the user's local network.
- Prevent: `validateRpcUrl` (packages/security/src/rpc.ts, unit-tested) enforces https-only, rejects credentials in the URL, rejects localhost/.local/.localhost, private+loopback+link-local+CGNAT IPv4, IPv6 literals, and bare (dotless) hosts. The default endpoint is always available and one click restores it. The custom endpoint is clearly labelled as user-supplied and never presented as verified. Read-only phase: a hostile endpoint cannot cause signing (no signing exists).
- Detect: Live RPC status panel shows connected/error against whatever endpoint is active; obviously-wrong reads surface as the panel's error state.
- Recover: "Reset to default" removes the custom endpoint and clears the stored value.
- Residual: A validated public endpoint that still returns false data (covered by C1 cross-check, planned before any transaction feature). User overriding with a hostile-but-well-formed public URL — mitigated by read-only scope + labelling.
- Test: 10 unit tests in rpc.test.ts (schemes, credentials, internal ranges, IPv6, bare host, messages); e2e asserts the Settings input exists ONLY under Settings and that a rejected URL is not applied.

### C1c. Browser storage of the custom endpoint (opt-in persistence)
- Path: Storing a user setting in localStorage widens the persisted surface (previously nothing was stored).
- Impact: Low. Only a validated public https RPC URL is stored — never addresses, keys, balances, or history. Another site cannot read it (same-origin). Local malware already outranks this.
- Prevent: Exactly one module (`apps/web/src/lib/rpc-storage.ts`) may touch localStorage, under a single reviewed key `omikami.rpcUrl`; value is re-validated with `validateRpcUrl` on read before use, so a tampered value is ignored. This is the ONLY approved exception to the no-browser-storage rule; it carries an in-file justification and a scoped lint/scan exemption. All other storage remains forbidden.
- Detect: Bundle/lint gates still block storage everywhere except that one file.
- Recover: Reset clears the key.
- Residual: A user on a shared machine leaves a preferred endpoint behind — non-sensitive by construction.
- Test: e2e refresh test still asserts no wallet/account/address keys are stored; rpc-storage read path re-validates.

### C2. Loss of RPC/indexer providers
- Path: Provider shutdown, rate limiting, or region blocks.
- Impact: App unusable or degraded.
- Prevent: Multiple defaults, user-supplied endpoints, direct-read architecture, indexers optional behind adapters.
- Detect: Fallback logging; clear degraded-state UI.
- Recover: Ship updated default list.
- Residual: Simultaneous outage of all defaults until user configures a custom RPC.
- Test: RPC-failure integration tests (timeouts, 429s, malformed responses).

### C3. Price-oracle manipulation
- Path: Manipulated price source shows wrong fiat values or masks bad swap rates.
- Impact: User accepts a bad trade.
- Prevent: Phase one shows no fiat prices; later, prices come from a documented source behind an adapter, displayed as estimates, and are never used to compute swap minimums (minimum-received comes from the DEX quote + user slippage).
- Detect: Sanity bounds (price deviation warnings).
- Recover: Disable price adapter without breaking the app.
- Residual: DEX pool manipulation (see E: sandwich/front-running).
- Test: Unit tests for deviation warnings; malformed-price tests.

## D. Address and token attacks

### D1. Address poisoning / similar-address attacks
- Path: Attacker seeds the user's history with lookalike addresses hoping for a copy-paste mistake.
- Impact: Funds sent to attacker.
- Prevent: SHIELD compares recipients against known-good history for high similarity with different identity; first/last character emphasis in every address display; full-address confirmation step on first-time recipients.
- Detect: Similarity warning at send time.
- Recover: On-chain transfers are irreversible — prevention only. UI never suggests recovery is possible.
- Residual: User overrides the warning.
- Test: Unit tests with generated lookalike pairs; e2e warning assertions.

### D2. Clipboard replacement
- Path: Malware or a malicious extension swaps a copied address in the clipboard.
- Impact: Funds sent to attacker.
- Prevent: Where the browser permits reading on paste, compare pasted value against what the app placed on copy; always re-display the parsed checksummed address before confirmation.
- Detect: Mismatch warning on paste.
- Recover: None post-broadcast; prevention only.
- Residual: Browsers restrict clipboard APIs; feature is best-effort and labelled as such.
- Test: Unit tests for the comparison logic; manual browser-matrix checks.

### D3. Fake tokens / malicious token metadata
- Path: Airdropped tokens with deceptive names/symbols, malicious `name()`/`symbol()` returns (huge strings, control characters, HTML), or fee-on-transfer/rebasing behavior.
- Impact: Phishing lure, UI corruption, wrong amounts.
- Prevent: Token identity = chainId+address only; metadata sanitized (length caps, character allowlist, rendered as text never HTML); unknown tokens quarantined in a separate section with warnings; React's default escaping plus no `dangerouslySetInnerHTML` anywhere.
- Detect: Heuristics: lookalike symbols vs. verified list, unsolicited airdrops.
- Recover: User hides/reports token locally.
- Residual: Novel deceptive metadata that passes sanitization but misleads humans.
- Test: Malicious-metadata unit tests (oversized strings, RTL overrides, emoji, HTML payloads).

## E. Transaction and approval attacks

### E1. Unlimited approvals
- Path: dApp habit or attacker UI encourages `approve(spender, MaxUint256)`.
- Impact: Spender compromise drains the full balance forever.
- Prevent: Exact approvals by default; unlimited only behind an advanced toggle with a severe warning; allowance manager surfaces existing unlimited approvals with revoke buttons.
- Detect: SHIELD flags any approval > requested spend; allowance dashboard shows amount at risk.
- Recover: Revoke flow.
- Residual: Approvals granted outside our app; we display them but can't prevent them.
- Test: Unit tests for approval-amount analysis; e2e default-exact-approval assertion.

### E2. Permit / Permit2 abuse and malicious typed data
- Path: Off-chain EIP-712 signature grants token rights without an on-chain approve; phishing sites request opaque typed data.
- Impact: Silent token drainage using a "gasless" signature.
- Prevent: SHIELD decodes known typed-data shapes (Permit, Permit2) into plain language: spender, amount, deadline; unknown typed data triggers a blind-signing warning; clear visual difference between "sign message" and "submit transaction".
- Detect: Warning heuristics on signature requests with token-transfer semantics.
- Recover: Where revocation applies (nonce invalidation/allowance revoke), guide the user.
- Residual: Novel typed-data formats not yet decoded — always labelled Unknown, never silently passed.
- Test: Unit tests decoding real Permit/Permit2 payloads (from official specs — addresses verified before inclusion); blind-signing warning e2e test.

### E3. Blind signing
- Path: Any request whose effects can't be decoded (opaque calldata, unknown contracts).
- Impact: Arbitrary loss.
- Prevent: Simulation attempt + decoded summary for every request; when decoding fails, an explicit "cannot verify what this does" warning with Reject as the visually primary action.
- Detect: Decode-failure path itself is the detection.
- Recover: None post-signature; prevention only.
- Residual: Users who confirm despite the warning.
- Test: e2e test with an undecodable payload asserting the warning renders.

### E4. Slippage attacks / front-running / sandwich attacks
- Path: MEV bots or manipulated pools exploit loose slippage settings.
- Impact: Materially worse execution price.
- Prevent: Configurable max slippage with a conservative default; severe warnings for high price impact; minimum-received enforced in the swap parameters; quotes expire and refresh; simulation before submit.
- Detect: Price-impact + expected-vs-minimum display.
- Recover: None post-execution.
- Residual: MEV within tolerated slippage is inherent to public mempools; documented honestly.
- Test: Slippage-calculation unit tests; expired-quote e2e tests.

### E5. Chain mismatch / replay
- Path: User signs on an unintended chain, or a signed payload is replayed elsewhere.
- Impact: Unintended transaction; replayed authorization.
- Prevent: Active chain displayed globally; every write validates expected chainId first; network-switch requests always explained; EIP-155 chain-bound transactions via viem; any future auth signatures carry nonce+domain+chain+expiry.
- Detect: Chain-mismatch blocker before preview.
- Recover: N/A.
- Residual: Wallet-side bugs outside our control.
- Test: Wrong-chain unit + e2e tests.

### E6. Wrong contract addresses
- Path: Typo or poisoned registry entry routes funds to a hostile contract.
- Impact: Total loss of the transacted amount.
- Prevent: All production addresses live in a reviewed registry, checksummed, each verified against multiple independent sources (official docs + explorer verification + deployer announcement) before merge; no placeholder addresses in executable config; unknown routers rejected, never silently substituted.
- Detect: Registry CI check re-verifying checksums; explorer cross-check script.
- Recover: Registry hotfix + disclosure.
- Residual: All public sources simultaneously wrong (extremely low).
- Test: Registry schema tests; checksum unit tests.

## F. Application and web attacks

### F1. Phishing clones
- Path: Attackers deploy lookalike domains with hostile builds.
- Impact: Users sign malicious payloads elsewhere, blaming the project.
- Prevent: Published official domains + IPFS CIDs; in-app display of official sources; no urgency-styled UI that clones could mimic to pressure users.
- Detect: Community reports; optional domain-monitoring pre-mainnet.
- Recover: Takedown requests; public warnings.
- Residual: High — inherent to open web; mitigated by user education.
- Test: N/A (process control).

### F2. XSS
- Path: Injected script via token metadata, ENS names, URL params, or a vulnerable dependency.
- Impact: Full UI compromise → falsified previews (worst realistic outcome for this app).
- Prevent: React escaping; no `dangerouslySetInnerHTML`; strict CSP (no inline/eval); sanitization of all chain-derived strings; dependency audit.
- Detect: CSP violation reports in dev; security review.
- Recover: Hotfix + disclosure.
- Residual: CSP bypasses in older browsers.
- Test: Malicious-metadata rendering tests; CSP header e2e assertion.

### F3. Clickjacking
- Path: Hostile page frames the app and overlays fake UI on real confirm buttons.
- Impact: Unintended clicks on sensitive actions.
- Prevent: `frame-ancestors 'none'` CSP directive (X-Frame-Options fallback where host allows).
- Detect: Header tests.
- Recover: N/A.
- Residual: Hosts that strip headers (IPFS gateways) — documented; critical confirmations still happen in the wallet, not our UI.
- Test: e2e header assertion; framed-load test.

### F4. CSRF
- Path: Classic CSRF needs a server session — phase one has no server and no cookies.
- Impact: N/A currently.
- Prevent: Keep no-cookie architecture; if any server component is ever added, standard CSRF tokens + SameSite.
- Residual: None in current architecture.
- Test: Architecture review at each phase.

### F5. Leaked environment variables / logging of wallet information
- Path: Secrets or user data accidentally bundled, logged, or sent to third parties.
- Impact: Privacy breach; provider-key abuse.
- Prevent: No secrets exist in the frontend by design; `.env.example` documents allowed public values; no analytics; console logging of addresses/balances stripped from production builds; error messages sanitized.
- Detect: Bundle-content scan in CI; manual network-tab review listing every outbound request (published in PRIVACY.md).
- Recover: Rotate any leaked provider identifier; disclose.
- Residual: RPC providers necessarily see IP + queried addresses — documented honestly in PRIVACY.md.
- Test: CI bundle scan; PRIVACY.md request inventory kept current per release.

### F6. Malicious browser extensions
- Path: Extension tampers with the DOM, injected provider, or clipboard.
- Impact: Falsified UI or hijacked requests.
- Prevent: Cannot fully prevent from a web page. Mitigations: wallet-side confirmation is the final authority (we say this in UI copy); SHIELD warnings live close to the wallet action; clipboard checks (D2).
- Detect: Provider-behavior sanity checks where feasible.
- Recover: User education content on the Security page.
- Residual: High for compromised browsers — stated honestly; the user's wallet display is the last line of defense.
- Test: Manual adversarial testing pre-mainnet.

## G. Contract-level threats (apply the moment any custom contract or Safe integration is considered — none in phase one)

### G1. Reentrancy / access-control failure / upgrade-key or admin-wallet compromise
- Path: Standard contract vulnerability classes.
- Impact: Contract-held funds drained or logic hijacked.
- Prevent: Phase one ships zero custom contracts (this is the primary control). Later: OpenZeppelin patterns, checks-effects-interactions, minimal admin surface, multisig+timelock on any upgrade key, Foundry unit/invariant tests, Slither, independent manual review, external audit per MAINNET_CHECKLIST Gate 10.
- Detect: Static analysis, invariant testing, monitoring on deployed contracts.
- Recover: Documented pause/disable/recovery procedure required before any contract ships.
- Residual: Unknown-unknowns in audited code; capped-beta limits blast radius.
- Test: Full Foundry + Slither + Echidna/invariant pipeline (future).

---

## Review gate

This document must be reviewed and signed off by a human before any transaction-capable feature (send, approve, swap) is implemented. Phase-one read-only shell may proceed after review of sections A, B, C, F.
