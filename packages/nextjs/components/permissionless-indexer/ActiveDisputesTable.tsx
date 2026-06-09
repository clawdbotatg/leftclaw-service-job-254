"use client";

import { useNow } from "~~/components/permissionless-indexer/useNow";
import { DISPUTE_STATUS_LABELS, truncateHex } from "~~/components/permissionless-indexer/utils";
import { useScaffoldEventHistory, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useWriteAndOpen } from "~~/hooks/scaffold-eth/useWriteAndOpen";

type DisputeData = readonly [
  string, // disputer
  string, // regId
  bigint, // counterStake
  number, // openedAt
  number, // status
  string, // commitHash
  boolean, // revealed
];

const STATUS_BADGE: Record<number, string> = {
  0: "badge-info",
  1: "badge-success",
  2: "badge-warning",
  3: "badge-error",
};

const DisputeRow = ({ disputeId }: { disputeId: string }) => {
  const { writeAndOpen } = useWriteAndOpen();
  const nowSecs = useNow();

  const { data: dispute } = useScaffoldReadContract({
    contractName: "PermissionlessIndexer",
    functionName: "disputes",
    args: [disputeId as `0x${string}`],
  });
  const { data: responseSecs } = useScaffoldReadContract({
    contractName: "PermissionlessIndexer",
    functionName: "DISPUTE_RESPONSE_SECS",
  });

  const { writeContractAsync, isMining } = useScaffoldWriteContract({
    contractName: "PermissionlessIndexer",
  });

  if (!dispute) {
    return (
      <tr>
        <td colSpan={5}>
          <span className="loading loading-spinner loading-xs" />
        </td>
      </tr>
    );
  }

  const d = dispute as unknown as DisputeData;
  const regId = d[1];
  const openedAt = Number(d[3]);
  const status = Number(d[4]);
  const deadline = openedAt + Number(responseSecs ?? 0);
  const secsLeft = deadline - nowSecs;
  const isOpen = status === 0;
  const pastDeadline = isOpen && secsLeft <= 0;

  const handleResolve = async () => {
    await writeAndOpen(() =>
      writeContractAsync({ functionName: "resolveDefaulted", args: [disputeId as `0x${string}`] }),
    );
  };

  return (
    <tr>
      <td className="font-mono text-xs">{truncateHex(disputeId)}</td>
      <td className="font-mono text-xs">{truncateHex(regId)}</td>
      <td className="text-xs">{openedAt ? new Date(openedAt * 1000).toLocaleString() : "—"}</td>
      <td>
        {isOpen ? (
          pastDeadline ? (
            <span className="text-error text-xs">deadline passed</span>
          ) : (
            <span className="text-xs">{Math.ceil(secsLeft / 60)} min left</span>
          )
        ) : (
          <span className="text-xs opacity-50">—</span>
        )}
      </td>
      <td>
        <span className={`badge ${STATUS_BADGE[status] ?? "badge-ghost"} badge-sm`}>
          {DISPUTE_STATUS_LABELS[status] ?? "unknown"}
        </span>
        {pastDeadline && (
          <button className="btn btn-error btn-xs ml-2" disabled={isMining} onClick={handleResolve}>
            Resolve Defaulted
          </button>
        )}
      </td>
    </tr>
  );
};

export const ActiveDisputesTable = () => {
  const { data: events, isLoading } = useScaffoldEventHistory({
    contractName: "PermissionlessIndexer",
    eventName: "DisputeOpened",
    fromBlock: 0n,
    watch: true,
  });

  const disputeIds = Array.from(new Set((events ?? []).map(e => e.args.disputeId as string).filter(Boolean)));

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body gap-3">
        <h2 className="card-title">Active Disputes</h2>
        {isLoading ? (
          <span className="loading loading-spinner" />
        ) : disputeIds.length === 0 ? (
          <p className="opacity-70 text-sm">No disputes opened yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Dispute</th>
                  <th>Reg ID</th>
                  <th>Opened</th>
                  <th>Deadline</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {disputeIds.map(id => (
                  <DisputeRow key={id} disputeId={id} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
