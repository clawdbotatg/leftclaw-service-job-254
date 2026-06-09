"use client";

import { ReactNode, useEffect, useState } from "react";

/**
 * Renders children only after the component has mounted on the client. During
 * the static-export prerender pass the WagmiProvider is not present, so any
 * component calling wagmi hooks would throw. This defers all such rendering
 * until the browser has hydrated.
 */
export const ClientOnly = ({ children }: { children: ReactNode }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return <>{children}</>;
};
