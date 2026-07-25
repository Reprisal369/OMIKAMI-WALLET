'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from '@/lib/wagmi';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Conservative retries: RPC failures surface as explicit UI states
            // instead of being hidden behind long silent retry loops.
            retry: 1,
            staleTime: 15_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // reconnectOnMount is disabled deliberately: with `storage: null` there is
  // no persisted session to restore, so the default on-mount reconnect only
  // triggers a spurious state update during hydration (React "setState while
  // rendering" warning). Injected wallets still connect on user click.
  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
