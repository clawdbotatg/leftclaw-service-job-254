"use client";

import type { NextPage } from "next";
import { ActiveRegistrationsTable } from "~~/components/permissionless-indexer/ActiveRegistrationsTable";
import { BaseStakeWidget } from "~~/components/permissionless-indexer/BaseStakeWidget";
import { BuybackReserveWidget } from "~~/components/permissionless-indexer/BuybackReserveWidget";
import { ClientOnly } from "~~/components/permissionless-indexer/ClientOnly";
import { WalletGate } from "~~/components/permissionless-indexer/WalletGate";

const Home: NextPage = () => {
  return (
    <div className="flex flex-col grow w-full px-4 py-8">
      <div className="max-w-5xl w-full mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">Indexer Dashboard</h1>
          <p className="opacity-70">Your indexer status and the protocol buyback reserve.</p>
        </div>

        <ClientOnly>
          <WalletGate>
            <div className="flex flex-col gap-6">
              <BaseStakeWidget />
              <ActiveRegistrationsTable />
              <BuybackReserveWidget />
            </div>
          </WalletGate>
        </ClientOnly>
      </div>
    </div>
  );
};

export default Home;
