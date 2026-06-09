"use client";

import { Address } from "@scaffold-ui/components";
import { useAccount } from "wagmi";
import { formatUsdc, truncateHex } from "~~/components/permissionless-indexer/utils";
import { useScaffoldEventHistory, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useWriteAndOpen } from "~~/hooks/scaffold-eth/useWriteAndOpen";

export const ActiveRegistrationsTable = () => {
  const { address } = useAccount();
  const { writeAndOpen } = useWriteAndOpen();

  const { data: events, isLoading } = useScaffoldEventHistory({
    contractName: "PermissionlessIndexer",
    eventName: "Registered",
    fromBlock: 0n,
    watch: true,
    filters: { indexer: address },
    enabled: !!address,
  });

  const { writeContractAsync, isMining } = useScaffoldWriteContract({
    contractName: "PermissionlessIndexer",
  });

  const handleDeregister = async (regId: string) => {
    await writeAndOpen(() => writeContractAsync({ functionName: "deregister", args: [regId as `0x${string}`] }));
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body gap-3">
        <h2 className="card-title">Your Registrations</h2>
        {isLoading ? (
          <span className="loading loading-spinner" />
        ) : !events || events.length === 0 ? (
          <p className="opacity-70 text-sm">No registrations found for your address.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Reg ID</th>
                  <th>Target</th>
                  <th>Event Sig</th>
                  <th>Boost</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => {
                  const regId = e.args.regId as string;
                  return (
                    <tr key={`${regId}-${i}`}>
                      <td className="font-mono text-xs">{truncateHex(regId)}</td>
                      <td>
                        <Address address={e.args.target} size="xs" />
                      </td>
                      <td className="font-mono text-xs">{truncateHex(e.args.eventSig as string, 6, 4)}</td>
                      <td>{formatUsdc(e.args.boost as bigint)} USDC</td>
                      <td className="text-right">
                        <button
                          className="btn btn-error btn-xs"
                          disabled={isMining}
                          onClick={() => handleDeregister(regId)}
                        >
                          Deregister
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
