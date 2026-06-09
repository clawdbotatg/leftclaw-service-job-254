"use client";

import type { NextPage } from "next";
import { BatchRegistrationForm } from "~~/components/permissionless-indexer/BatchRegistrationForm";
import { ClientOnly } from "~~/components/permissionless-indexer/ClientOnly";
import { DepositBaseStake } from "~~/components/permissionless-indexer/DepositBaseStake";
import { PendingRegistrations } from "~~/components/permissionless-indexer/PendingRegistrations";
import { WalletGate } from "~~/components/permissionless-indexer/WalletGate";

const Register: NextPage = () => {
  return (
    <div className="flex flex-col grow w-full px-4 py-8">
      <div className="max-w-5xl w-full mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">Register</h1>
          <p className="opacity-70">Stake USDC and register contract events to index.</p>
        </div>

        <ClientOnly>
          <WalletGate>
            <div className="flex flex-col gap-6">
              <DepositBaseStake />
              <BatchRegistrationForm />
              <PendingRegistrations />
            </div>
          </WalletGate>
        </ClientOnly>
      </div>
    </div>
  );
};

export default Register;
