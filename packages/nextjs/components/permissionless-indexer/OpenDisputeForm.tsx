"use client";

import { useMemo, useState } from "react";
import { encodePacked, keccak256 } from "viem";
import { isHex32 } from "~~/components/permissionless-indexer/utils";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useWriteAndOpen } from "~~/hooks/scaffold-eth/useWriteAndOpen";

export const OpenDisputeForm = () => {
  const { writeAndOpen } = useWriteAndOpen();
  const [regId, setRegId] = useState("");
  const [queryNonce, setQueryNonce] = useState("");
  const [secret, setSecret] = useState("");

  const { writeContractAsync, isMining } = useScaffoldWriteContract({
    contractName: "PermissionlessIndexer",
  });

  const regIdValid = isHex32(regId);
  const secretValid = isHex32(secret);
  const nonceValid = queryNonce.trim() !== "" && !isNaN(Number(queryNonce));

  const commitHash = useMemo(() => {
    if (!regIdValid || !secretValid || !nonceValid) return null;
    try {
      return keccak256(
        encodePacked(
          ["bytes32", "uint256", "bytes32"],
          [regId.trim() as `0x${string}`, BigInt(queryNonce), secret.trim() as `0x${string}`],
        ),
      );
    } catch {
      return null;
    }
  }, [regId, queryNonce, secret, regIdValid, secretValid, nonceValid]);

  const valid = regIdValid && secretValid && nonceValid;

  const handleOpen = async () => {
    await writeAndOpen(() =>
      writeContractAsync({
        functionName: "openDispute",
        args: [regId.trim() as `0x${string}`, BigInt(queryNonce), secret.trim() as `0x${string}`],
      }),
    );
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body gap-3">
        <h2 className="card-title">2. Open Dispute (Reveal)</h2>
        <div>
          <label className="text-sm font-medium">Reg ID (bytes32)</label>
          <input
            type="text"
            placeholder="0x…"
            className={`input input-bordered w-full font-mono text-sm ${
              regId.length > 0 && !regIdValid ? "input-error" : ""
            }`}
            value={regId}
            onChange={e => setRegId(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Query nonce (uint256)</label>
          <input
            type="number"
            min="0"
            placeholder="0"
            className="input input-bordered w-full"
            value={queryNonce}
            onChange={e => setQueryNonce(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Secret (bytes32)</label>
          <input
            type="text"
            placeholder="0x…"
            className={`input input-bordered w-full font-mono text-sm ${
              secret.length > 0 && !secretValid ? "input-error" : ""
            }`}
            value={secret}
            onChange={e => setSecret(e.target.value)}
          />
        </div>

        {commitHash && (
          <div className="rounded-box bg-base-200 p-3 text-xs">
            <span className="opacity-70">Computed commitHash</span>
            <div className="font-mono break-all">{commitHash}</div>
          </div>
        )}

        <div className="alert alert-warning text-sm">
          Opening a dispute requires posting a counter-stake in USDC. Make sure you have enough balance and allowance.
        </div>

        <button className="btn btn-primary w-full" disabled={!valid || isMining} onClick={handleOpen}>
          {isMining && <span className="loading loading-spinner loading-xs" />}
          Open Dispute
        </button>
      </div>
    </div>
  );
};
