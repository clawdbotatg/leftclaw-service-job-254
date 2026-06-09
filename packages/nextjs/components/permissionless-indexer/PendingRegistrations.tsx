"use client";

import { Address } from "@scaffold-ui/components";
import { useAccount } from "wagmi";
import { formatUsdc, truncateHex } from "~~/components/permissionless-indexer/utils";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

export const PendingRegistrations = () => {
  const { address } = useAccount();

  const { data: events, isLoading } = useScaffoldEventHistory({
    contractName: "PermissionlessIndexer",
    eventName: "Registered",
    fromBlock: 0n,
    watch: true,
    filters: { indexer: address },
    enabled: !!address,
  });

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body gap-3">
        <h2 className="card-title">Your Registrations</h2>
        {isLoading ? (
          <span className="loading loading-spinner" />
        ) : !events || events.length === 0 ? (
          <p className="opacity-70 text-sm">No registrations yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((e, i) => (
              <li key={`${e.args.regId}-${i}`} className="rounded-box bg-base-200 p-3 flex flex-col gap-1 text-sm">
                <span className="font-mono text-xs">regId {truncateHex(e.args.regId as string)}</span>
                <div className="flex items-center gap-2">
                  <span className="opacity-70">target</span>
                  <Address address={e.args.target} size="xs" />
                </div>
                <span className="font-mono text-xs">eventSig {truncateHex(e.args.eventSig as string)}</span>
                <span>boost {formatUsdc(e.args.boost as bigint)} USDC</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
