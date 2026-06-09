"use client";

import type { NextPage } from "next";
import { ActiveDisputesTable } from "~~/components/permissionless-indexer/ActiveDisputesTable";
import { ClientOnly } from "~~/components/permissionless-indexer/ClientOnly";
import { CommitDisputeForm } from "~~/components/permissionless-indexer/CommitDisputeForm";
import { OpenDisputeForm } from "~~/components/permissionless-indexer/OpenDisputeForm";
import { RespondDisputePanel } from "~~/components/permissionless-indexer/RespondDisputePanel";
import { WalletGate } from "~~/components/permissionless-indexer/WalletGate";

const Disputes: NextPage = () => {
  return (
    <div className="flex flex-col grow w-full px-4 py-8">
      <div className="max-w-5xl w-full mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">Disputes</h1>
          <p className="opacity-70">Commit-reveal disputes with EIP-4788 beacon proof verification.</p>
        </div>

        <ClientOnly>
          <ActiveDisputesTable />

          <WalletGate>
            <div className="flex flex-col gap-6">
              <div className="grid lg:grid-cols-2 gap-6">
                <CommitDisputeForm />
                <OpenDisputeForm />
              </div>
              <RespondDisputePanel />
            </div>
          </WalletGate>
        </ClientOnly>
      </div>
    </div>
  );
};

export default Disputes;
