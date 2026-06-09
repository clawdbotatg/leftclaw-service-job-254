"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ApproveAndAct } from "~~/components/permissionless-indexer/ApproveAndAct";
import { MIN_BASE_STAKE_USDC, formatUsdc, parseUsdc } from "~~/components/permissionless-indexer/utils";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useWriteAndOpen } from "~~/hooks/scaffold-eth/useWriteAndOpen";

export const DepositBaseStake = () => {
  const { address } = useAccount();
  const { writeAndOpen } = useWriteAndOpen();
  const [amount, setAmount] = useState("");

  const { data: baseStake } = useScaffoldReadContract({
    contractName: "PermissionlessIndexer",
    functionName: "baseStake",
    args: [address],
  });

  const { writeContractAsync, isMining } = useScaffoldWriteContract({
    contractName: "PermissionlessIndexer",
  });

  const amountUnits = parseUsdc(amount);
  const currentStake = baseStake ?? 0n;
  const minUnits = parseUsdc(String(MIN_BASE_STAKE_USDC));
  const belowMin = currentStake < minUnits;

  const handleDeposit = async () => {
    await writeAndOpen(() => writeContractAsync({ functionName: "depositBaseStake", args: [amountUnits] }));
    setAmount("");
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body gap-3">
        <h2 className="card-title">Deposit Base Stake</h2>
        <div className="flex items-center justify-between text-sm">
          <span className="opacity-70">Current base stake</span>
          <span className="font-mono">{formatUsdc(currentStake)} USDC</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="opacity-70">Minimum required</span>
          <span className="font-mono">{MIN_BASE_STAKE_USDC} USDC</span>
        </div>
        {belowMin && (
          <div className="alert alert-warning text-sm">
            Base stake is below the {MIN_BASE_STAKE_USDC} USDC minimum required to register.
          </div>
        )}

        <label className="text-sm font-medium">Deposit amount (USDC)</label>
        <input
          type="number"
          min="0"
          placeholder="0.0"
          className="input input-bordered w-full"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
        <ApproveAndAct
          requiredAllowance={amountUnits}
          actionLabel="Deposit Base Stake"
          disabled={amountUnits <= 0n}
          acting={isMining}
          onAct={handleDeposit}
        />
      </div>
    </div>
  );
};
