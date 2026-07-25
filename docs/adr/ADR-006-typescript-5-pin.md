# ADR-006 — Pin TypeScript to 5.9.3 (not 7.0.2)

Date: 2026-07-13 · Status: Accepted

## Context

PROJECT_PLAN.md assumption A1 required verifying stack compatibility at scaffold time. TypeScript 7.0.2 (latest on the registry) passed `tsc --noEmit` on all packages and worked with Next 16.2.10, but typescript-eslint 8.63.0 crashed against it (`TypeError ... reading 'Cjs'` in typescript-estree), breaking the lint gate.

## Decision

Pin `typescript` to 5.9.3 (latest verified-compatible 5.x) in every workspace package. Result: lint, typecheck, tests, and production build all pass.

## Consequences

- Revisit when typescript-eslint publishes TS 7 support; upgrade goes through DEPENDENCY_POLICY review.
- No security impact: both versions are dev-time compilers; the lint gate integrity was the deciding factor.
