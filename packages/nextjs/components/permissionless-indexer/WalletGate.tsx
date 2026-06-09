"use client";

import { ReactNode } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

/**
 * Gates write UIs behind a connect → switch-network flow, showing exactly one
 * actionable button at a time. When connected to the correct network it renders
 * its children.
 */
export const WalletGate = ({ children }: { children: ReactNode }) => {
  const { address, isConnected, chain } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || !address) {
    return (
      <div className="flex justify-center">
        <RainbowKitCustomConnectButton />
      </div>
    );
  }

  if (chain?.id !== targetNetwork.id) {
    return (
      <div className="flex justify-center">
        <button
          className="btn btn-primary"
          disabled={isPending}
          onClick={() => switchChain({ chainId: targetNetwork.id })}
        >
          {isPending && <span className="loading loading-spinner loading-xs" />}
          Switch to {targetNetwork.name}
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
