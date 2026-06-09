"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { truncateHex } from "~~/components/permissionless-indexer/utils";
import { useScaffoldEventHistory, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useWriteAndOpen } from "~~/hooks/scaffold-eth/useWriteAndOpen";

type DisputeData = readonly [string, string, bigint, number, number, string, boolean];

/**
 * Checks a single dispute: is it open AND is the connected address the indexer
 * defending the disputed registration? Renders an option if so.
 */
const DefendingOption = ({
  disputeId,
  address,
  onMatch,
}: {
  disputeId: string;
  address?: string;
  onMatch: (id: string) => void;
}) => {
  const { data: dispute } = useScaffoldReadContract({
    contractName: "PermissionlessIndexer",
    functionName: "disputes",
    args: [disputeId as `0x${string}`],
  });
  const regId = dispute ? (dispute as unknown as DisputeData)[1] : undefined;
  const status = dispute ? Number((dispute as unknown as DisputeData)[4]) : undefined;

  const { data: reg } = useScaffoldReadContract({
    contractName: "PermissionlessIndexer",
    functionName: "regs",
    args: [regId as `0x${string}`],
  });
  const indexer = reg ? (reg as unknown as readonly [string])[0] : undefined;

  const isDefending = status === 0 && !!address && !!indexer && indexer.toLowerCase() === address.toLowerCase();

  if (!isDefending) return null;
  return (
    <option value={disputeId} onClick={() => onMatch(disputeId)}>
      {truncateHex(disputeId)}
    </option>
  );
};

export const RespondDisputePanel = () => {
  const { address } = useAccount();
  const { writeAndOpen } = useWriteAndOpen();

  const [disputeId, setDisputeId] = useState("");
  const [receiptProof, setReceiptProof] = useState("");
  const [beaconProof, setBeaconProof] = useState("");

  const { data: events } = useScaffoldEventHistory({
    contractName: "PermissionlessIndexer",
    eventName: "DisputeOpened",
    fromBlock: 0n,
    watch: true,
  });

  const { writeContractAsync, isMining } = useScaffoldWriteContract({
    contractName: "PermissionlessIndexer",
  });

  const disputeIds = Array.from(new Set((events ?? []).map(e => e.args.disputeId as string).filter(Boolean)));

  const handleRespond = async () => {
    await writeAndOpen(() =>
      writeContractAsync({
        functionName: "respondDispute",
        args: [
          disputeId.trim() as `0x${string}`,
          (receiptProof.trim() || "0x") as `0x${string}`,
          (beaconProof.trim() || "0x") as `0x${string}`,
        ],
      }),
    );
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body gap-3">
        <h2 className="card-title">Respond to Dispute</h2>
        <p className="text-xs opacity-70">
          Select a dispute where you are the defending indexer, then submit your proofs.
        </p>

        <label className="text-sm font-medium">Dispute ID</label>
        <select
          className="select select-bordered w-full font-mono text-sm"
          value={disputeId}
          onChange={e => setDisputeId(e.target.value)}
        >
          <option value="">Select an open dispute against you…</option>
          {disputeIds.map(id => (
            <DefendingOption key={id} disputeId={id} address={address} onMatch={() => {}} />
          ))}
        </select>

        <label className="text-sm font-medium">Receipt proof (hex bytes)</label>
        <input
          type="text"
          placeholder="0x…"
          className="input input-bordered w-full font-mono text-sm"
          value={receiptProof}
          onChange={e => setReceiptProof(e.target.value)}
        />

        <label className="text-sm font-medium">Beacon proof (hex bytes)</label>
        <input
          type="text"
          placeholder="0x…"
          className="input input-bordered w-full font-mono text-sm"
          value={beaconProof}
          onChange={e => setBeaconProof(e.target.value)}
        />

        <div className="alert alert-info text-xs">See GitHub issue #4 for proof format requirements.</div>

        <button className="btn btn-primary w-full" disabled={!disputeId || isMining} onClick={handleRespond}>
          {isMining && <span className="loading loading-spinner loading-xs" />}
          Respond to Dispute
        </button>
      </div>
    </div>
  );
};
