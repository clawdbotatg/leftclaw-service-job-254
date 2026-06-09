"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { INDEXER_ADDRESS } from "~~/components/permissionless-indexer/utils";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useWriteAndOpen } from "~~/hooks/scaffold-eth/useWriteAndOpen";
import { notification } from "~~/utils/scaffold-eth";

type ApproveAndActProps = {
  /** USDC amount (in 1e6 base units) that must be approved before acting. */
  requiredAllowance: bigint;
  /** Label for the action button. */
  actionLabel: string;
  /** Disable the whole flow (e.g. invalid form). */
  disabled?: boolean;
  /** Fires when allowance is sufficient and the user confirms the action. */
  onAct: () => Promise<void>;
  /** True while the action write is mining (passed up from parent). */
  acting?: boolean;
};

/**
 * Renders ONE button at a time: Approve USDC (while allowance is insufficient)
 * then the action button once allowance covers `requiredAllowance`.
 */
export const ApproveAndAct = ({ requiredAllowance, actionLabel, disabled, onAct, acting }: ApproveAndActProps) => {
  const { address } = useAccount();
  const { writeContractAsync: approveAsync, isMining: approveMining } = useScaffoldWriteContract({
    contractName: "USDC",
  });
  const { writeAndOpen } = useWriteAndOpen();

  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalCooldown, setApprovalCooldown] = useState(false);

  const { data: allowance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "allowance",
    args: [address, INDEXER_ADDRESS],
  });

  useEffect(() => {
    if (!approvalCooldown) return;
    const t = setTimeout(() => setApprovalCooldown(false), 4000);
    return () => clearTimeout(t);
  }, [approvalCooldown]);

  const needsApproval = requiredAllowance > 0n && (allowance ?? 0n) < requiredAllowance;

  const handleApprove = async () => {
    setApprovalSubmitting(true);
    try {
      await writeAndOpen(() =>
        approveAsync({
          functionName: "approve",
          args: [INDEXER_ADDRESS, requiredAllowance],
        }),
      );
      setApprovalCooldown(true);
    } catch (e) {
      console.error(e);
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const handleAct = async () => {
    try {
      await onAct();
    } catch (e) {
      console.error(e);
      notification.error("Action failed");
    }
  };

  if (needsApproval) {
    const busy = approvalSubmitting || approveMining || approvalCooldown;
    return (
      <button className="btn btn-primary w-full" disabled={disabled || busy} onClick={handleApprove}>
        {busy && <span className="loading loading-spinner loading-xs" />}
        {approvalCooldown ? "Approval confirming…" : "Approve USDC"}
      </button>
    );
  }

  return (
    <button className="btn btn-primary w-full" disabled={disabled || acting} onClick={handleAct}>
      {acting && <span className="loading loading-spinner loading-xs" />}
      {actionLabel}
    </button>
  );
};
