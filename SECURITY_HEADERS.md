# OMIKAMI WALLET — Security headers & CSP (Gate 7)

This app is a **static export** with no server, so HTTP security headers must be
set by the hosting layer. `scripts/generate-csp.mjs` (`pnpm csp`) produces a
ready-to-serve `apps/web/out/_headers` after each build. This document explains
the policy, the per-host variants, and the one real trade-off (custom RPC
endpoints).

Nothing here is deployed yet — this is deployment preparation.

## The policy

Run after building:

```
pnpm build
pnpm csp     # writes apps/web/out/_headers
```

Content-Security-Policy (generated):

```
default-src 'none';
script-src 'self' 'sha256-…'(×N inline hydration scripts);
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self' https://11155111.rpc.thirdweb.com https://eth.merkle.io;
manifest-src 'self';
worker-src 'self';
frame-src 'none';
frame-ancestors 'none';
base-uri 'none';
form-action 'none';
object-src 'none';
upgrade-insecure-requests
```

Plus: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer`, a locked-down `Permissions-Policy`,
`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy:
same-origin`, `Cross-Origin-Embedder-Policy: require-corp`, and HSTS.

### Why each choice

- **`default-src 'none'`** — deny everything, then re-allow the minimum. Any
  resource type we forgot is blocked, not silently permitted.
- **`script-src 'self' 'sha256-…'`** — a Next.js static export inlines a few
  hydration scripts (`self.__next_f.push(...)`). A static site cannot use a
  per-request nonce, so we allow each inline block by its **exact SHA-256 hash**
  and nothing else. No `'unsafe-inline'`, no `'unsafe-eval'` for scripts — an
  injected `<script>` will not run. Hashes are regenerated every build.
- **`style-src 'self' 'unsafe-inline'`** — the framework emits some inline
  `<style>`. Inline *style* injection is far lower risk than script injection
  (it cannot exfiltrate or execute); this is the common, accepted compromise.
  It can be tightened to style hashes later.
- **`connect-src`** — the ONLY network destinations the running app fetches:
  the Sepolia default RPC and the Ethereum-mainnet default RPC (used only if the
  wallet is on mainnet). Everything else (block explorers) is an `<a>` link, not
  a fetch, so it does not need `connect-src`. This mirrors `PRIVACY.md`.
- **`frame-ancestors 'none'` + `X-Frame-Options: DENY`** — the wallet can never
  be iframed (clickjacking / overlay-approval scams).
- **`base-uri 'none'`, `form-action 'none'`, `object-src 'none'`** — no `<base>`
  hijacking, no form exfiltration (the app has no server form target), no
  plugins.
- **`upgrade-insecure-requests` + HSTS** — force HTTPS end to end.

## Custom RPC endpoints (important trade-off)

The Settings panel lets a user point the app at their own Sepolia RPC. That is a
`fetch` to an arbitrary `https://` host, which the strict `connect-src` above
**will block**. Choose one before enabling custom endpoints in production:

1. **Keep strict (recommended default).** Ship the generated policy. The custom
   endpoint feature only works on deployments that widen `connect-src`. Simplest
   and safest for a public default deployment.
2. **Allow any HTTPS RPC.** Replace the `connect-src` line with
   `connect-src 'self' https:`. This restores the custom-endpoint feature but
   lets the page connect to any HTTPS host — a real weakening. Only do this if
   the custom-endpoint feature is a hard requirement, and document it.

`generate-csp.mjs` hardcodes option 1. To use option 2, edit `CONNECT_SRC` in
that script (swap the two hosts for `'https:'`) and regenerate.

> UX note (internal pre-audit L5): under option 1 the Settings custom-RPC field
> is present but any value the user sets is silently blocked by `connect-src` on
> the live site, which can confuse users. Preferred future handling on a
> strict-CSP deployment: hide/disable the field or show an in-UI note that custom
> endpoints require a self-hosted build. Tracked as a UX/polish item, not a
> vulnerability.

## Per-host variants

### Cloudflare Pages / Netlify — `_headers`

Both read a `_headers` file at the site root. `pnpm csp` already writes it to
`apps/web/out/_headers`; publish the `apps/web/out` directory as-is. No extra
config.

### Netlify — `netlify.toml` (alternative)

If you prefer `netlify.toml` over `_headers`, mirror the same values under
`[[headers]]` with `for = "/*"`. Keep ONE source of truth — do not set the CSP
in both files. A ready template is in `deploy/netlify.toml`.

### Vercel — `vercel.json`

Vercel ignores `_headers`. Put the same headers under `"headers"` in
`vercel.json` (a template is in `deploy/vercel.json`). Note Vercel is a hosted
platform, not decentralized — see `DECENTRALIZATION.md`.

### IPFS / IPFS gateways — `<meta>` fallback

IPFS gateways do not send custom HTTP headers, so `_headers` is ignored and
`frame-ancestors`, HSTS, and `X-Frame-Options` **cannot** be delivered there.
The parts of the CSP that work via a `<meta http-equiv="Content-Security-Policy">`
tag (everything except `frame-ancestors`) can be injected into the exported HTML.
This is a weaker posture (no framing protection at the gateway) and is why a
dedicated host or a gateway that supports headers is preferred for the primary
deployment. If you ship to IPFS:

- Serve the primary site from a host that sets real headers (custom domain in
  front of the CID, e.g. Cloudflare), OR
- Add the `<meta>` CSP at build time and accept the missing framing protection,
  clearly noting it in the release.

## Dev vs production

Local `next dev` needs `'unsafe-eval'` (React Fast Refresh) and inline scripts —
so the production CSP is intentionally **not** applied in dev. Never copy the dev
posture to production. The generated `_headers` is a production artifact only.

## Verifying after deploy (RELEASE_CHECKLIST Gate 7)

- `curl -I https://<your-host>/` shows the CSP and all headers on a normal route
  **and** on an error route (e.g. `/does-not-exist`).
- Load the app in a browser with DevTools open: zero CSP violation errors during
  connect, balance, activity, allowance, and transfer-preview flows.
- Re-run `pnpm build && pnpm csp` if the app changed — inline-script hashes move
  with the build, and a stale hash list will break hydration under CSP.
