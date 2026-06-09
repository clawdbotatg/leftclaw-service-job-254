import { INDEXER_ADDRESS } from "~~/components/permissionless-indexer/utils";

export const QueryPayloadDocs = () => {
  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body gap-3">
        <h2 className="card-title">EIP-712 Query Payment</h2>
        <p className="text-sm opacity-70">
          Consumers sign this typed payload to authorize a per-query USDC payment to an indexer.
        </p>
        <pre className="bg-base-300 text-base-content rounded-box p-4 overflow-x-auto text-xs leading-relaxed">
          <code>{`QueryPayment {
  bytes32 regId;
  address consumer;
  uint96  fee;
  uint256 nonce;
}

Domain {
  name:              "PermissionlessIndexer"
  version:           "1"
  chainId:           8453
  verifyingContract: ${INDEXER_ADDRESS}
}`}</code>
        </pre>
      </div>
    </div>
  );
};
