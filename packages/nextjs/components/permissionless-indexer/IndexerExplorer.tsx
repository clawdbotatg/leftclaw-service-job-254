"use client";

import { useMemo, useState } from "react";
import { Address, AddressInput } from "@scaffold-ui/components";
import { formatUsdc, parseUsdc, truncateHex } from "~~/components/permissionless-indexer/utils";
import { useScaffoldEventHistory, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

type Indexer = {
  regId: string;
  indexer: string;
  target: string;
  eventSig: string;
  boost: bigint;
};

const IndexerCard = ({ item }: { item: Indexer }) => {
  const { data: reputation } = useScaffoldReadContract({
    contractName: "PermissionlessIndexer",
    functionName: "getReputation",
    args: [item.regId as `0x${string}`],
  });

  const uniqueConsumers = Number(reputation?.uniqueConsumers ?? 0);
  const reputationAge = reputation?.reputationAge ?? 0n;

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body gap-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs opacity-70">regId {truncateHex(item.regId)}</span>
          <span className="badge badge-primary">{uniqueConsumers} consumers</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="opacity-70">Indexer</span>
          <Address address={item.indexer as `0x${string}`} size="xs" />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="opacity-70">Target</span>
          <Address address={item.target as `0x${string}`} size="xs" />
          <a
            href={`https://basescan.org/address/${item.target}`}
            target="_blank"
            rel="noreferrer"
            className="link link-primary text-xs"
          >
            basescan
          </a>
        </div>
        <div className="text-sm font-mono break-all">
          <span className="opacity-70 font-sans">eventSig </span>
          {item.eventSig}
        </div>
        <div className="flex gap-4 text-sm">
          <span>
            <span className="opacity-70">boost </span>
            {formatUsdc(item.boost)} USDC
          </span>
          <span>
            <span className="opacity-70">repAge </span>
            {reputationAge.toString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export const IndexerExplorer = () => {
  const [targetFilter, setTargetFilter] = useState("");
  const [minBoost, setMinBoost] = useState("");

  const { data: events, isLoading } = useScaffoldEventHistory({
    contractName: "PermissionlessIndexer",
    eventName: "Registered",
    fromBlock: 0n,
    watch: true,
  });

  const indexers = useMemo<Indexer[]>(() => {
    if (!events) return [];
    const byRegId = new Map<string, Indexer>();
    for (const e of events) {
      const regId = e.args.regId as string;
      if (!regId || byRegId.has(regId)) continue;
      byRegId.set(regId, {
        regId,
        indexer: e.args.indexer as string,
        target: e.args.target as string,
        eventSig: e.args.eventSig as string,
        boost: (e.args.boost as bigint) ?? 0n,
      });
    }

    const minBoostUnits = minBoost ? parseUsdc(minBoost) : 0n;
    const targetLower = targetFilter.trim().toLowerCase();

    return Array.from(byRegId.values())
      .filter(item => (targetLower ? item.target.toLowerCase() === targetLower : true))
      .filter(item => item.boost >= minBoostUnits)
      .sort((a, b) => (a.boost < b.boost ? 1 : a.boost > b.boost ? -1 : 0));
  }, [events, targetFilter, minBoost]);

  return (
    <div className="flex flex-col gap-6">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body gap-3">
          <h2 className="card-title">Search Indexers</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs opacity-70">Target contract (optional)</label>
              <AddressInput value={targetFilter} onChange={setTargetFilter} placeholder="0x… filter by target" />
            </div>
            <div>
              <label className="text-xs opacity-70">Min boost (USDC, optional)</label>
              <input
                type="number"
                min="0"
                placeholder="0.0"
                className="input input-bordered w-full"
                value={minBoost}
                onChange={e => setMinBoost(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <span className="loading loading-spinner mx-auto" />
      ) : indexers.length === 0 ? (
        <p className="opacity-70 text-sm text-center">No registrations match your filters.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {indexers.map(item => (
            <IndexerCard key={item.regId} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};
