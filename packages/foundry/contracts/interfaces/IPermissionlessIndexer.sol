// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IPermissionlessIndexer
/// @notice Interface for the PermissionlessIndexer protocol: a permissionless registry of
///         event indexers staked in USDC, with query accounting, dispute resolution backed by
///         EIP-4788 beacon proofs, and a CLAWD buyback-and-burn from protocol fees.
interface IPermissionlessIndexer {
    /*//////////////////////////////////////////////////////////////
                                 STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct RegData {
        address indexer;
        uint32 registeredAt;
        uint96 boostStake;
        uint32 uniqueConsumers;
        uint32 totalQueries;
        uint32 disputesLost;
        uint32 disputesWon;
        uint32 firstQueryTs;
        uint32 withdrawableAt;
        bool deregistered;
    }

    struct Dispute {
        address disputer;
        bytes32 regId;
        uint96 counterStake;
        uint32 openedAt;
        uint8 status; // 0=open, 1=indexerWon, 2=disputerWon, 3=defaulted
        bytes32 commitHash;
        bool revealed;
    }

    struct Registration {
        address target;
        bytes32 eventSig;
        uint96 boost;
    }

    struct Reputation {
        address indexer;
        uint96 boostStake;
        uint32 uniqueConsumers;
        uint32 totalQueries;
        uint32 disputesLost;
        uint32 disputesWon;
        uint32 firstQueryTs;
        uint256 reputationAge;
    }

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event Registered(
        address indexed indexer, bytes32 indexed regId, address target, bytes32 eventSig, uint96 boost
    );
    event Deregistered(bytes32 indexed regId);
    event QueryRecorded(bytes32 indexed regId, address indexed consumer, uint96 fee);
    event DisputeCommitted(address indexed disputer, bytes32 commitHash);
    event DisputeOpened(bytes32 indexed disputeId, bytes32 indexed regId, address disputer);
    event DisputeResolved(bytes32 indexed disputeId, uint8 outcome);
    event BuybackExecuted(uint96 usdcSpent, uint256 clawdBurned);
    event ReputationMilestone(address indexed indexer, bytes32 indexed regId, uint32 uniqueConsumers);
    event BaseStakeSlashed(address indexed indexer, uint96 amount);
    event BoostStakeSlashed(bytes32 indexed regId, uint96 amount);

    /*//////////////////////////////////////////////////////////////
                                FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function depositBaseStake(uint96 amount) external;
    function withdrawBaseStake(uint96 amount) external;
    function registerBatch(Registration[] calldata registrations) external;
    function deregister(bytes32 regId) external;
    function withdrawBoost(bytes32 regId) external;
    function recordQuery(bytes32 regId, address consumer, uint96 fee, bytes calldata sig) external;
    function commitDispute(bytes32 commitHash) external;
    function openDispute(bytes32 regId, uint256 queryNonce, bytes32 secret) external;
    function respondDispute(bytes32 disputeId, bytes calldata receiptProof, bytes calldata beaconProof)
        external;
    function resolveDefaulted(bytes32 disputeId) external;
    function executeBuyback(uint96 minClawdOut) external;

    function getReputation(bytes32 regId) external view returns (Reputation memory);
    function reputationAge(bytes32 regId) external view returns (uint256);
    function getCounterStakeBps(address disputer) external view returns (uint16);
}
