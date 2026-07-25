import type { NextConfig } from 'next';

/**
 * Static export: no server functions, IPFS-compatible output in `out/`.
 * NOTE (Gate 7): static export cannot emit HTTP response headers, so the
 * strict Content-Security-Policy is applied by the hosting layer at
 * deployment time and verified during the frontend security review.
 * This is documented as an open item in PROJECT_STATE.md — not complete.
 */
const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  transpilePackages: [
    '@omikami/chain-config',
    '@omikami/security',
    '@omikami/token-registry',
    '@omikami/types',
    '@omikami/ui',
  ],
};

export default nextConfig;
