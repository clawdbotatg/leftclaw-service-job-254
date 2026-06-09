"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ApproveAndAct } from "~~/components/permissionless-indexer/ApproveAndAct";
import { useNow } from "~~/components/permissionless-indexer/useNow";
import { formatUsdc, parseUsdc } from "~~/components/permissionless-indexer/utils";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useWriteAndOpen } from "~~/hooks/scaffold-eth/useWriteAndOpen";

export const BaseStakeWidget = () => {
  const { address } = useAccount();
  const { writeAndOpen } = useWriteAndOpen();

  const { data: baseStake } = useScaffoldReadContract({
    contractName: "PermissionlessIndexer",
    functionName: "baseStake",
    args: [address],
  });
  const { data: cooldownUntil } = useScaffoldReadContract({
    contractName: "PermissionlessIndexer",
    functionName: "baseSlashCooldownUntil",
    args: [address],
  });
  const { data: slashCount } = useScaffoldReadContract({
    contractName: "PermissionlessIndexer",
    functionName: "baseSlashCount",
    args: [address],
  });
  const { data: openDisputes } = useScaffoldReadContract({
    contractName: "PermissionlessIndexer",
    functionName: "openDisputeCount",
    args: [address],
  });

  const { writeContractAsync: indexerWrite, isMining } = useScaffoldWriteContract({
    contractName: "PermissionlessIndexer",
  });

  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const nowSecs = useNow();
  const cooldownActive = Number(cooldownUntil ?? 0) > nowSecs;
  const cooldownRemaining = cooldownActive ? Number(cooldownUntil) - nowSecs : 0;
  const hasOpenDisputes = Number(openDisputes ?? 0) > 0;
  const withdrawDisabled = hasOpenDisputes || cooldownActive;

  const depositUnits = parseUsdc(depositAmount);
  const withdrawUnits = parseUsdc(withdrawAmount);

  const handleDeposit = async () => {
    await writeAndOpen(() => indexerWrite({ functionName: "depositBaseStake", args: [depositUnits] }));
    setDepositAmount("");
    setShowDeposit(false);
  };

  const handleWithdraw = async () => {
    await writeAndOpen(() => indexerWrite({ functionName: "withdrawBaseStake", args: [withdrawUnits] }));
    setWithdrawAmount("");
    setShowWithdraw(false);
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body gap-3">
        <h2 className="card-title">Base Stake</h2>

        <div className="stats stats-vertical sm:stats-horizontal bg-base-200">
          <div className="stat">
            <div className="stat-title">Current Stake</div>
            <div className="stat-value text-2xl">{formatUsdc(baseStake)} USDC</div>
          </div>
          <div className="stat">
            <div className="stat-title">Slashes</div>
            <div className="stat-value text-2xl">{Number(slashCount ?? 0)}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Open Disputes</div>
            <div className="stat-value text-2xl">{Number(openDisputes ?? 0)}</div>
          </div>
        </div>

        {cooldownActive && (
          <div className="alert alert-warning text-sm">
            Slash cooldown active — {Math.ceil(cooldownRemaining / 60)} min remaining before withdrawals.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setShowDeposit(v => !v);
              setShowWithdraw(false);
            }}
          >
            Deposit
          </button>
          <button
            className="btn btn-outline btn-sm"
            disabled={withdrawDisabled}
            onClick={() => {
              setShowWithdraw(v => !v);
              setShowDeposit(false);
            }}
          >
            Withdraw
          </button>
        </div>

        {showDeposit && (
          <div className="rounded-box bg-base-200 p-4 flex flex-col gap-3">
            <label className="text-sm font-medium">Deposit amount (USDC)</label>
            <input
              type="number"
              min="0"
              placeholder="0.0"
              className="input input-bordered w-full"
              value={depositAmount}
              onChange={e => setDepositAmount(e.target.value)}
            />
            <p className="text-xs opacity-70">USDC approval is requested first, then the deposit is submitted.</p>
            <ApproveAndAct
              requiredAllowance={depositUnits}
              actionLabel="Deposit Base Stake"
              disabled={depositUnits <= 0n}
              acting={isMining}
              onAct={handleDeposit}
            />
          </div>
        )}

        {showWithdraw && (
          <div className="rounded-box bg-base-200 p-4 flex flex-col gap-3">
            <label className="text-sm font-medium">Withdraw amount (USDC)</label>
            <input
              type="number"
              min="0"
              placeholder="0.0"
              className="input input-bordered w-full"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
            />
            <button
              className="btn btn-primary w-full"
              disabled={withdrawUnits <= 0n || isMining}
              onClick={handleWithdraw}
            >
              {isMining && <span className="loading loading-spinner loading-xs" />}
              Withdraw Base Stake
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
