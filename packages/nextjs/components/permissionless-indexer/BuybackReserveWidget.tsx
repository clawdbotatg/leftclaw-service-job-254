"use client";

import { useState } from "react";
import { formatUsdc } from "~~/components/permissionless-indexer/utils";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useWriteAndOpen } from "~~/hooks/scaffold-eth/useWriteAndOpen";

export const BuybackReserveWidget = () => {
  const { writeAndOpen } = useWriteAndOpen();
  const [minClawdOut, setMinClawdOut] = useState("0");

  const { data: reserve } = useScaffoldReadContract({
    contractName: "PermissionlessIndexer",
    functionName: "buybackReserveUSDC",
  });

  const { writeContractAsync, isMining } = useScaffoldWriteContract({
    contractName: "PermissionlessIndexer",
  });

  const reserveEmpty = (reserve ?? 0n) === 0n;

  const handleBuyback = async () => {
    let parsed: bigint;
    try {
      parsed = BigInt(minClawdOut || "0");
    } catch {
      parsed = 0n;
    }
    await writeAndOpen(() => writeContractAsync({ functionName: "executeBuyback", args: [parsed] }));
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body gap-3">
        <h2 className="card-title">Buyback Reserve</h2>
        <div className="stat bg-base-200 rounded-box">
          <div className="stat-title">Reserve</div>
          <div className="stat-value text-2xl">{formatUsdc(reserve)} USDC</div>
          <div className="stat-desc">Swapped to CLAWD and burned via Uniswap V3.</div>
        </div>

        <label className="text-sm font-medium">Min CLAWD out (wei)</label>
        <input
          type="text"
          inputMode="numeric"
          placeholder="0"
          className="input input-bordered w-full"
          value={minClawdOut}
          onChange={e => setMinClawdOut(e.target.value)}
        />
        <button className="btn btn-primary w-full" disabled={reserveEmpty || isMining} onClick={handleBuyback}>
          {isMining && <span className="loading loading-spinner loading-xs" />}
          Execute Buyback
        </button>
        {reserveEmpty && <p className="text-xs opacity-70">Reserve is empty — nothing to buy back.</p>}
      </div>
    </div>
  );
};
