import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'OMIKAMI WALLET',
  description:
    'Non-custodial Ethereum wallet dashboard. Read-only phase on Sepolia. Never asks for a seed phrase or private key.',
};

const NAV_ITEMS = [
  { label: 'Portfolio', active: true },
  { label: 'Send', active: false },
  { label: 'Receive', active: false },
  { label: 'Swap', active: false },
  { label: 'Activity', active: false },
  { label: 'Allowances', active: false },
  { label: 'Security', active: false },
  { label: 'Settings', active: false },
] as const;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 sm:px-6">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded focus:border focus:border-[var(--omi-gold-dim)] focus:bg-[var(--omi-surface)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--omi-gold)]"
        >
          Skip to main content
        </a>
        <header className="flex flex-col gap-4 border-b border-[var(--omi-border)] py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-2">
            <h1 className="flex items-baseline gap-2 text-lg font-semibold">
              <span className="tracking-[0.28em] text-[var(--omi-gold)]">OMIKAMI</span>
              <span className="font-light tracking-[0.28em] text-[var(--omi-text)]">WALLET</span>
            </h1>
            <span className="ml-2 rounded border border-[var(--omi-border)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--omi-muted)]">
              Read-only preview
            </span>
          </div>
          <nav aria-label="Main navigation" className="-mx-1 overflow-x-auto">
            <ul className="flex items-center gap-1 whitespace-nowrap text-sm">
              {NAV_ITEMS.map((item) =>
                item.active ? (
                  <li key={item.label}>
                    <span
                      aria-current="page"
                      className="rounded-md bg-[rgba(201,162,74,0.10)] px-3 py-1.5 font-medium text-[var(--omi-gold)]"
                    >
                      {item.label}
                    </span>
                  </li>
                ) : (
                  <li key={item.label}>
                    <span
                      aria-disabled="true"
                      title="Available in a later phase"
                      className="cursor-not-allowed rounded-md px-3 py-1.5 text-[var(--omi-muted)] opacity-60"
                    >
                      {item.label}
                    </span>
                  </li>
                ),
              )}
            </ul>
          </nav>
        </header>
        <main id="main" className="flex-1 py-6">
          <Providers>{children}</Providers>
        </main>
        <footer className="border-t border-[var(--omi-border)] py-4 text-xs text-[var(--omi-muted)]">
          Non-custodial · No analytics · Read-only phase · Ethereum Sepolia (testnet) · OMIKAMI
          WALLET never asks for a seed phrase or private key.
        </footer>
      </body>
    </html>
  );
}
