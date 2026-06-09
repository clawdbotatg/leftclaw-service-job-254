"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { isHex32, truncateHex } from "~~/components/permissionless-indexer/utils";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useWriteAndOpen } from "~~/hooks/scaffold-eth/useWriteAndOpen";

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

export const CommitDisputeForm = () => {
  const { address } = useAccount();
  const { writeAndOpen } = useWriteAndOpen();
  const [commitHash, setCommitHash] = useState("");

  const { data: pendingCommit } = useScaffoldReadContract({
    contractName: "PermissionlessIndexer",
    functionName: "pendingCommits",
    args: [address],
  });

  const { writeContractAsync, isMining } = useScaffoldWriteContract({
    contractName: "PermissionlessIndexer",
  });

  const valid = isHex32(commitHash);
  const hasPending = pendingCommit && pendingCommit !== ZERO_HASH;

  const handleCommit = async () => {
    await writeAndOpen(() =>
      writeContractAsync({ functionName: "commitDispute", args: [commitHash.trim() as `0x${string}`] }),
    );
    setCommitHash("");
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body gap-3">
        <h2 className="card-title">1. Commit Dispute</h2>
        {hasPending && (
          <div className="alert alert-info text-sm">
            Pending commit: <span className="font-mono">{truncateHex(pendingCommit as string)}</span>
          </div>
        )}
        <label className="text-sm font-medium">Commit hash (bytes32)</label>
        <input
          type="text"
          placeholder="0x… keccak256(regId, queryNonce, secret)"
          className={`input input-bordered w-full font-mono text-sm ${
            commitHash.length > 0 && !valid ? "input-error" : ""
          }`}
          value={commitHash}
          onChange={e => setCommitHash(e.target.value)}
        />
        <button className="btn btn-primary w-full" disabled={!valid || isMining} onClick={handleCommit}>
          {isMining && <span className="loading loading-spinner loading-xs" />}
          Commit Dispute
        </button>
      </div>
    </div>
  );
};
