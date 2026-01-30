"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren, useMemo } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export function Providers({ children }: PropsWithChildren) {
  const queryClient = useMemo(() => new QueryClient(), []);

  const config = useMemo(
    () =>
      createConfig({
        chains: [sepolia],
        connectors: [injected()],
        transports: {
          [sepolia.id]: http()
        }
      }),
    []
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
