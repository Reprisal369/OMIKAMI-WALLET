# OMIKAMI WALLET — INCIDENT_RESPONSE.md

Date: 2026-07-13 · Status: process defined; contact channels to be established before any public deployment (Gate 11).

## Severity levels

- **SEV-1** — users can lose funds or be tricked into harmful signatures (compromised deployment, malicious dependency in a shipped build, DNS hijack, hostile clone at an official-looking domain).
- **SEV-2** — integrity/privacy issue without direct fund risk (XSS without signing impact, data leak in errors, broken security warning).
- **SEV-3** — degraded security posture (failing gate in CI, provider outage, missing header at host).

## SEV-1 runbook (compromised deployment / dependency / DNS)

1. **Contain** — take the deployment offline or point DNS to a static warning page; if a dependency: pin to last known-good lockfile and rebuild.
2. **Warn** — publish a warning through the predefined out-of-band channels (repository README/security advisory + the project's public channels), including: what happened, who is affected, the single action users should take ("do not sign anything on <domain>; revoke approvals granted after <time>").
3. **Rotate** — revoke and rotate all registrar/hosting/CI credentials; verify hardware-key inventory; check audit logs.
4. **Verify** — rebuild from clean environment, compare hashes with the last published release manifest, redeploy only after two-person review.
5. **Post-mortem** — public write-up within 14 days: timeline, root cause, controls added. No incident is closed without a merged control.

## Rules

- Never downplay: if user action is required, say it first and plainly.
- One person may declare an incident; closing one requires two.
- Recovery must never depend on a single person's access (Gate 1 review requirement).
- Rehearse the SEV-1 runbook once before mainnet beta (MAINNET_CHECKLIST Gate 12 prerequisite).

## Vulnerability reports

Handled per SECURITY.md (acknowledgment within 72 hours). Reports that reveal an actively exploitable SEV-1 trigger this runbook immediately.
