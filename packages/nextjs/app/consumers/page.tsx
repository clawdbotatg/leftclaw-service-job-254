"use client";

import type { NextPage } from "next";
import { ClientOnly } from "~~/components/permissionless-indexer/ClientOnly";
import { IndexerExplorer } from "~~/components/permissionless-indexer/IndexerExplorer";
import { QueryPayloadDocs } from "~~/components/permissionless-indexer/QueryPayloadDocs";

const Consumers: NextPage = () => {
  return (
    <div className="flex flex-col grow w-full px-4 py-8">
      <div className="max-w-5xl w-full mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">Consumers</h1>
          <p className="opacity-70">Discover registered indexers and learn how to pay for queries.</p>
        </div>

        <ClientOnly>
          <IndexerExplorer />
        </ClientOnly>
        <QueryPayloadDocs />
      </div>
    </div>
  );
};

export default Consumers;
