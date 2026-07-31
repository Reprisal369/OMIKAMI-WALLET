# OMIKAMI WALLET — Accessibility Review (WCAG 2.1 / 2.2 AA)

- **Scope:** static UI of the read-only build — `apps/web/src` (layout, page, 8 panels) and `packages/ui`.
- **Version reviewed:** v0.5.3 (frozen audit candidate).
- **Method:** source-level audit against WCAG 2.1 AA (plus 2.2 target-size), including a computed
  colour-contrast pass on the design tokens in `globals.css`.
- **Status of this document:** findings only. No code was changed — the freeze is respected. Fixes
  are proposed for a later, separate pass once you decide which to apply.

Severity uses the familiar axe/Deque scale: **Serious → Moderate → Minor**. Nothing here is a
"Critical" blocker; the app is already well above average for accessibility.

---

## What is already good (keep it)

- **Landmarks are correct:** `<header>`, `<nav aria-label="Main navigation">`, `<main>`, `<footer>`.
- **Async states are announced:** `role="status"` / `role="alert"` are used consistently for
  loading, wrong-network, errors, and the transfer-preview verdict.
- **Status is never colour-only:** every `StatusBadge` carries a text label (OK / Info / Warning /
  Blocked); Activity shows "Received / Sent / Self" as words, not just colour. Passes **1.4.1**.
- **Focus is visible on the main controls:** `ActionButton`, `<input>`, and `<select>` all have an
  explicit `focus-visible` gold outline.
- **Form fields are labelled:** the Settings RPC field uses `htmlFor`/`id`; the Send fields wrap
  their control in a `<label>` (valid implicit association).
- **`lang="en"` is set**, and inputs use sensible `autocomplete="off"` / `inputMode`.
- **Text contrast is strong** for the main palette (see table below).

---

## Colour contrast (computed)

Ratios of each token against the two backgrounds (`--omi-bg #0b0b0d`, `--omi-surface #131317`).
AA needs **4.5:1** for normal text, **3:1** for large text and non-text UI.

| Token | on bg | on surface | Verdict (normal text) |
|---|---|---|---|
| text `#ededef` | 16.82 | 15.85 | ✅ excellent |
| muted `#9a9aa3` | 7.05 | 6.64 | ✅ passes |
| gold `#c9a24b` | 8.20 | 7.72 | ✅ passes |
| ok `#4aa46e` | 6.39 | 6.02 | ✅ passes |
| warn `#d69e2e` | 8.23 | 7.76 | ✅ passes |
| **danger `#c85050`** | 4.42 | **4.16** | ⚠️ **just below 4.5** on surface |
| gold-dim `#6e5827` | 2.89 | 2.73 | borders/underline only — not body text |

---

## Findings

### Serious

**S1 — "↗" explorer links have no accessible name** · WCAG 1.1.1, 2.4.4
`AllowanceDashboardPanel.tsx` (quarantine list) renders explorer links whose only content is the
character `↗`. A screen reader announces "link, ↗" (or nothing useful), so the purpose is lost.
*Fix:* give each an `aria-label`, e.g. `aria-label="View token on block explorer"` /
`"View spender on block explorer"`.

### Moderate

**M1 — No `<h1>`; heading hierarchy starts at `<h2>`** · WCAG 1.3.1, 2.4.6
The site title "OMIKAMI WALLET" in the header is styled `<span>`s. The first heading on the page is
a panel `<h2>`. *Fix:* make the wordmark an `<h1>` (or add a visually-hidden `<h1>OMIKAMI WALLET —
read-only Ethereum dashboard</h1>` at the top of `<main>`).

**M2 — No "skip to main content" link** · WCAG 2.4.1
The nav sits before `<main>` with no bypass. *Fix:* add a visually-hidden skip link as the first
focusable element, targeting `#main`.

**M3 — Inline buttons/links lack a visible focus style on the dark theme** · WCAG 2.4.7
`CopyButton`, the inline "Copy" in `ConnectPanel`, all "Retry" buttons, and the `Explorer` / `Tx`
links rely on the browser default focus ring, which is weak on `#0b0b0d`. *Fix:* reuse the same
`focus-visible:outline` gold pattern already used on `ActionButton`.

**M4 — Errors/help not programmatically tied to their field** · WCAG 3.3.1, 3.3.3
Settings RPC (`role="alert"` error) and the Send recipient/amount inputs don't reference their
help/error text. *Fix:* add `aria-describedby` (and `aria-invalid={true}` when errored) pointing at
the message `id`s.

**M5 — `danger` text is 4.16:1 (below 4.5) for small text** · WCAG 1.4.3
Affects small red text (blocked badge label, "unlimited allowance" note, would-block summary).
*Fix:* lighten `--omi-danger` slightly (e.g. `#d46a6a` ≈ 5.2:1 on surface). Purely a token tweak;
the tinted backgrounds behind this text make the real-world ratio marginally lower still.

**M6 — Small touch targets (<24×24 px)** · WCAG 2.5.8 (2.2 AA)
`CopyButton` (`py-0.5 text-xs`) and the `↗` links are below the 24 px minimum. *Fix:* add padding
or a min-height so the hit area reaches 24 px.

**M7 — Repeated ambiguous link text** · WCAG 2.4.4
Many links read simply "Explorer" / "Tx" / "↗" to different destinations. *Fix:* add distinguishing
`aria-label`s (e.g. "View USDC contract on explorer", "View transaction on explorer").

### Minor

- **m1 — Copy confirmation not announced** (4.1.3): the button swaps "Copy"→"Copied" with no
  `aria-live`, so SR users don't hear it. *Fix:* small visually-hidden `aria-live="polite"` note.
- **m2 — `title`-only tooltips** on the disabled nav items aren't keyboard/SR accessible (minor;
  they're placeholders for future phases).
- **m3 — Disabled nav items aren't focusable** — acceptable while they're placeholders; revisit
  when Send/Receive/Swap ship so they become real links/buttons.
- **m4 — `gold-dim` borders/underline** are low-contrast (~2.7:1). Non-text, so exempt, but nudging
  it up would sharpen the primary-button border and link underlines.

---

## Suggested fix order (when you lift the freeze)

1. **S1 + M7** — add `aria-label`s to explorer/tx/↗ links (biggest SR win, tiny change).
2. **M1 + M2** — `<h1>` + skip link (structural, low risk).
3. **M3 + M6** — focus styles + target size on the small controls (shared `CopyButton` covers most).
4. **M4** — `aria-describedby` / `aria-invalid` on the three inputs.
5. **M5 (+ m4)** — token colour tweak for `--omi-danger` (and optionally `--omi-gold-dim`).
6. **m1–m3** — polish.

All of these are presentational/markup changes in `apps/web/src` and `packages/ui`. **None touch the
read-only invariant, the security gates, wagmi/viem transport, CSP, or any forbidden-pattern rule**,
so they fit inside the audit freeze as UI-only improvements — but they should still go through your
normal PR + gates flow.
