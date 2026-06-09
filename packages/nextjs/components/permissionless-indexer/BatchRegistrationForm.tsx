"use client";

import { useMemo, useState } from "react";
import { AddressInput } from "@scaffold-ui/components";
import { useAccount } from "wagmi";
import { ApproveAndAct } from "~~/components/permissionless-indexer/ApproveAndAct";
import { MIN_BASE_STAKE_USDC, formatUsdc, isHex32, parseUsdc } from "~~/components/permissionless-indexer/utils";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useWriteAndOpen } from "~~/hooks/scaffold-eth/useWriteAndOpen";
import { notification } from "~~/utils/scaffold-eth";

type Row = { target: string; eventSig: string; boost: string };

const emptyRow = (): Row => ({ target: "", eventSig: "", boost: "" });
const MAX_ROWS = 10;

export const BatchRegistrationForm = () => {
  const { address } = useAccount();
  const { writeAndOpen } = useWriteAndOpen();
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  const { data: baseStake } = useScaffoldReadContract({
    contractName: "PermissionlessIndexer",
    functionName: "baseStake",
    args: [address],
  });

  const { writeContractAsync, isMining } = useScaffoldWriteContract({
    contractName: "PermissionlessIndexer",
  });

  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows(prev => (prev.length < MAX_ROWS ? [...prev, emptyRow()] : prev));
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const totalBoostUnits = useMemo(() => rows.reduce((acc, r) => acc + parseUsdc(r.boost || "0"), 0n), [rows]);

  const rowsValid = rows.length > 0 && rows.every(r => r.target.length > 0 && isHex32(r.eventSig));
  const minUnits = parseUsdc(String(MIN_BASE_STAKE_USDC));
  const baseStakeOk = (baseStake ?? 0n) >= minUnits;

  const handleRegister = async () => {
    if (!baseStakeOk) {
      notification.warning(`Base stake must be at least ${MIN_BASE_STAKE_USDC} USDC before registering.`);
      return;
    }
    const registrations = rows.map(r => ({
      target: r.target as `0x${string}`,
      eventSig: r.eventSig.trim() as `0x${string}`,
      boost: parseUsdc(r.boost || "0"),
    }));
    await writeAndOpen(() => writeContractAsync({ functionName: "registerBatch", args: [registrations] }));
    setRows([emptyRow()]);
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body gap-4">
        <h2 className="card-title">Batch Registration</h2>
        {!baseStakeOk && (
          <div className="alert alert-warning text-sm">
            Your base stake is below {MIN_BASE_STAKE_USDC} USDC. Deposit more before registering.
          </div>
        )}

        <div className="flex flex-col gap-4">
          {rows.map((row, i) => (
            <div key={i} className="rounded-box bg-base-200 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Registration #{i + 1}</span>
                {rows.length > 1 && (
                  <button className="btn btn-ghost btn-xs" onClick={() => removeRow(i)}>
                    Remove
                  </button>
                )}
              </div>
              <div>
                <label className="text-xs opacity-70">Target contract</label>
                <AddressInput
                  value={row.target}
                  onChange={val => updateRow(i, { target: val })}
                  placeholder="0x… target contract"
                />
              </div>
              <div>
                <label className="text-xs opacity-70">Event signature (bytes32)</label>
                <input
                  type="text"
                  placeholder="0x… (32-byte topic0)"
                  className={`input input-bordered w-full font-mono text-sm ${
                    row.eventSig.length > 0 && !isHex32(row.eventSig) ? "input-error" : ""
                  }`}
                  value={row.eventSig}
                  onChange={e => updateRow(i, { eventSig: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs opacity-70">Boost (USDC, optional)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0.0"
                  className="input input-bordered w-full"
                  value={row.boost}
                  onChange={e => updateRow(i, { boost: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button className="btn btn-outline btn-sm" disabled={rows.length >= MAX_ROWS} onClick={addRow}>
            Add row ({rows.length}/{MAX_ROWS})
          </button>
          <span className="text-sm">
            Total boost approval: <span className="font-mono">{formatUsdc(totalBoostUnits)} USDC</span>
          </span>
        </div>

        <ApproveAndAct
          requiredAllowance={totalBoostUnits}
          actionLabel="Register Batch"
          disabled={!rowsValid}
          acting={isMining}
          onAct={handleRegister}
        />
        {!rowsValid && (
          <p className="text-xs opacity-70">Each row needs a target address and a valid 32-byte event signature.</p>
        )}
      </div>
    </div>
  );
};
