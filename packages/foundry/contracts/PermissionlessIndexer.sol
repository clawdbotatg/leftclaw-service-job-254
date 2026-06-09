// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IPermissionlessIndexer } from "./interfaces/IPermissionlessIndexer.sol";

/// @notice Minimal Uniswap V3 SwapRouter02 interface (periphery not vendored).
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256 amountOut);
}

/// @title PermissionlessIndexer
/// @notice Permissionless registry of event indexers staked in USDC. Indexers register
///         (target, eventSig) pairs with a boost stake; consumers pay per-query fees split
///         between indexer/keeper/treasury/buyback; disputes are settled via EIP-4788 beacon
///         proofs with commit-reveal; protocol fees fund a CLAWD buyback-and-burn.
/// @dev No owner, no roles, no upgradeability. TREASURY is immutable. Reentrancy is guarded with
///      EIP-1153 transient storage (requires the Cancun EVM or later).
contract PermissionlessIndexer is IPermissionlessIndexer {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                               IMMUTABLES
    //////////////////////////////////////////////////////////////*/

    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address public constant CLAWD = 0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07;
    address public constant UNISWAP_V3_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    address public constant BEACON_ROOTS_ADDRESS = 0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02;
    uint24 public constant POOL_FEE = 3000;

    /// @dev Set in constructor; the treasury that receives the treasury fee share.
    address public immutable TREASURY;
    /// @dev The CLAWD/USDC Uniswap V3 pool address (informational reference).
    address public immutable UNISWAP_V3_POOL;

    uint96 public constant MIN_BASE_STAKE_USDC = 5_000_000;
    uint96 public constant MIN_QUERY_FEE = 10_000; // 0.01 USDC
    uint96 public constant MIN_QUERY_FOR_REPUTATION = 10_000; // 0.01 USDC
    uint96 public constant MIN_COUNTER_STAKE = 2_000_000;

    uint32 public constant DISPUTE_WINDOW_SECS = 72_000;
    uint32 public constant DISPUTE_RESPONSE_SECS = 21_600;
    uint32 public constant BOOST_WITHDRAWAL_COOLDOWN = 93_600;
    uint32 public constant BASE_SLASH_COOLDOWN_SECS = 172_800;

    uint16 public constant DISPUTE_COUNTER_STAKE_BPS = 2_500;
    uint16 public constant BASE_SLASH_PCT_BPS = 2_000;
    uint16 public constant BOOST_SLASH_PCT_BPS = 10_000;
    uint32 public constant TWAP_WINDOW_SECS = 1_800;
    uint16 public constant PROTOCOL_VERSION = 1;

    /*//////////////////////////////////////////////////////////////
                              EIP-712 DOMAIN
    //////////////////////////////////////////////////////////////*/

    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant QUERY_PAYMENT_TYPEHASH =
        keccak256("QueryPayment(bytes32 regId,address consumer,uint96 fee,uint256 nonce)");
    bytes32 public immutable DOMAIN_SEPARATOR;

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    mapping(address => uint96) public baseStake;
    mapping(address => uint32) public baseSlashCooldownUntil;
    mapping(address => uint8) public baseSlashCount;

    mapping(bytes32 => RegData) public regs; // regId = keccak256(abi.encodePacked(indexer, target, eventSig))
    mapping(bytes32 => mapping(address => bool)) public hasCounted;
    /// @notice Tracks the most recent query timestamp per regId for dispute-window checks.
    mapping(bytes32 => uint32) public lastQueryTs;

    mapping(bytes32 => Dispute) public disputes;
    mapping(address => uint8) public openDisputeCount;
    mapping(address => uint8) public lostDisputeCount;
    mapping(address => bytes32) public pendingCommits;

    mapping(address => uint256) public queryNonces;

    uint96 public buybackReserveUSDC;

    /*//////////////////////////////////////////////////////////////
                          STAKE/BOOST EVENTS
    //////////////////////////////////////////////////////////////*/

    event BaseStakeDeposited(address indexed indexer, uint96 amount);
    event BaseStakeWithdrawn(address indexed indexer, uint96 amount);
    event BoostWithdrawn(bytes32 indexed regId, address indexed indexer, uint96 amount);

    /*//////////////////////////////////////////////////////////////
                            REENTRANCY GUARD
    //////////////////////////////////////////////////////////////*/

    // keccak256("PermissionlessIndexer.reentrancy")
    bytes32 private constant REENTRANCY_SLOT =
        0xa40e939bca1805c3f4912b35959eb7a7955413bb03c5a70a0ed80f0e1a1191a2;

    modifier nonReentrant() {
        assembly {
            if tload(REENTRANCY_SLOT) { revert(0, 0) }
            tstore(REENTRANCY_SLOT, 1)
        }
        _;
        assembly {
            tstore(REENTRANCY_SLOT, 0)
        }
    }

    /*//////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address treasury, address uniswapPool) {
        require(treasury != address(0), "treasury=0");
        TREASURY = treasury;
        UNISWAP_V3_POOL = uniswapPool;

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes("PermissionlessIndexer")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    /*//////////////////////////////////////////////////////////////
                                STAKING
    //////////////////////////////////////////////////////////////*/

    function depositBaseStake(uint96 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        baseStake[msg.sender] += amount;
        IERC20(USDC).safeTransferFrom(msg.sender, address(this), amount);
        emit BaseStakeDeposited(msg.sender, amount);
    }

    function withdrawBaseStake(uint96 amount) external nonReentrant {
        uint96 current = baseStake[msg.sender];
        require(current >= amount, "insufficient");
        require(current - amount >= MIN_BASE_STAKE_USDC, "below min");
        require(openDisputeCount[msg.sender] == 0, "open disputes");
        require(block.timestamp > baseSlashCooldownUntil[msg.sender], "cooldown");

        baseStake[msg.sender] = current - amount;
        IERC20(USDC).safeTransfer(msg.sender, amount);
        emit BaseStakeWithdrawn(msg.sender, amount);
    }

    /*//////////////////////////////////////////////////////////////
                              REGISTRATION
    //////////////////////////////////////////////////////////////*/

    function registerBatch(Registration[] calldata registrations) external nonReentrant {
        require(registrations.length > 0, "empty");
        require(baseStake[msg.sender] >= MIN_BASE_STAKE_USDC, "base stake");

        // Sum total boost first; single external transfer for the whole batch.
        uint256 totalBoost;
        for (uint256 i = 0; i < registrations.length; ++i) {
            totalBoost += registrations[i].boost;
        }
        if (totalBoost > 0) {
            require(totalBoost <= type(uint96).max, "boost overflow");
            IERC20(USDC).safeTransferFrom(msg.sender, address(this), totalBoost);
        }

        // No external calls inside the loop.
        for (uint256 i = 0; i < registrations.length; ++i) {
            Registration calldata r = registrations[i];
            bytes32 regId = keccak256(abi.encodePacked(msg.sender, r.target, r.eventSig));

            RegData storage existing = regs[regId];
            // Active = previously registered by this indexer and not deregistered.
            require(!(existing.indexer == msg.sender && !existing.deregistered), "already registered");

            if (existing.deregistered) {
                // Block re-registration while boost withdrawal is pending.
                require(
                    existing.boostStake == 0 && block.timestamp >= existing.withdrawableAt,
                    "boost withdrawal pending"
                );
                // Now safe to re-register: reset the slot.
                delete regs[regId];
            }

            RegData storage reg = regs[regId];
            reg.indexer = msg.sender;
            reg.registeredAt = uint32(block.timestamp);
            reg.boostStake = r.boost;
            reg.uniqueConsumers = 0;
            reg.totalQueries = 0;
            reg.disputesLost = 0;
            reg.disputesWon = 0;
            reg.firstQueryTs = 0;
            reg.withdrawableAt = 0;
            reg.deregistered = false;

            emit Registered(msg.sender, regId, r.target, r.eventSig, r.boost);
        }
    }

    function deregister(bytes32 regId) external {
        RegData storage reg = regs[regId];
        require(reg.indexer == msg.sender, "not indexer");
        require(!reg.deregistered, "already deregistered");

        reg.deregistered = true;
        reg.withdrawableAt = uint32(block.timestamp + BOOST_WITHDRAWAL_COOLDOWN);

        emit Deregistered(regId);
    }

    function withdrawBoost(bytes32 regId) external nonReentrant {
        RegData storage reg = regs[regId];
        require(reg.indexer == msg.sender, "not indexer");
        require(reg.deregistered, "not deregistered");
        require(block.timestamp >= reg.withdrawableAt, "cooldown");
        require(openDisputeCount[msg.sender] == 0, "open disputes");

        uint96 amount = reg.boostStake;
        reg.boostStake = 0;
        if (amount > 0) {
            IERC20(USDC).safeTransfer(msg.sender, amount);
        }
        emit BoostWithdrawn(regId, msg.sender, amount);
    }

    /*//////////////////////////////////////////////////////////////
                               QUERIES
    //////////////////////////////////////////////////////////////*/

    function recordQuery(bytes32 regId, address consumer, uint96 fee, bytes calldata sig)
        external
        nonReentrant
    {
        require(fee >= MIN_QUERY_FEE, "fee too low");
        RegData storage reg = regs[regId];
        require(!reg.deregistered, "deregistered");
        address indexer = reg.indexer;
        require(indexer != address(0), "unknown reg");

        // Verify EIP-712 signature from consumer; per-consumer nonce prevents replay.
        uint256 nonce = queryNonces[consumer];
        bytes32 structHash =
            keccak256(abi.encode(QUERY_PAYMENT_TYPEHASH, regId, consumer, fee, nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        require(ECDSA.recover(digest, sig) == consumer, "bad sig");
        queryNonces[consumer] = nonce + 1;

        // Fee split.
        uint96 keeperShare = fee / 1000;
        uint96 treasuryShare = fee / 1000;
        uint96 buybackShare = fee / 1000;
        uint96 indexerShare = fee - keeperShare - treasuryShare - buybackShare;

        // Effects before interactions where possible.
        buybackReserveUSDC += buybackShare;

        bool newConsumer;
        if (fee >= MIN_QUERY_FOR_REPUTATION && !hasCounted[regId][consumer]) {
            hasCounted[regId][consumer] = true;
            reg.uniqueConsumers += 1;
            if (reg.firstQueryTs == 0) {
                reg.firstQueryTs = uint32(block.timestamp);
            }
            newConsumer = true;
        }
        reg.totalQueries += 1;
        lastQueryTs[regId] = uint32(block.timestamp);

        // Interactions: pull full fee, then distribute.
        IERC20(USDC).safeTransferFrom(consumer, address(this), fee);
        if (keeperShare > 0) IERC20(USDC).safeTransfer(msg.sender, keeperShare);
        if (treasuryShare > 0) IERC20(USDC).safeTransfer(TREASURY, treasuryShare);
        if (indexerShare > 0) IERC20(USDC).safeTransfer(indexer, indexerShare);

        emit QueryRecorded(regId, consumer, fee);
        if (newConsumer) {
            emit ReputationMilestone(indexer, regId, reg.uniqueConsumers);
        }
    }

    /*//////////////////////////////////////////////////////////////
                                DISPUTES
    //////////////////////////////////////////////////////////////*/

    function commitDispute(bytes32 commitHash) external {
        pendingCommits[msg.sender] = commitHash;
        emit DisputeCommitted(msg.sender, commitHash);
    }

    function openDispute(bytes32 regId, uint256 queryNonce, bytes32 secret) external nonReentrant {
        // Reveal against the prior commitment.
        require(
            keccak256(abi.encodePacked(regId, queryNonce, secret)) == pendingCommits[msg.sender],
            "bad reveal"
        );

        RegData storage reg = regs[regId];
        address indexer = reg.indexer;
        require(indexer != address(0), "unknown reg");

        // Dispute window is measured against the latest indexed query.
        uint32 ref = lastQueryTs[regId];
        require(ref != 0, "no queries");
        require(block.timestamp <= uint256(ref) + DISPUTE_WINDOW_SECS, "window closed");
        require(openDisputeCount[indexer] < 3, "too many disputes");

        uint96 counterStake = uint96((uint256(reg.boostStake) * getCounterStakeBps(msg.sender)) / 10000);
        require(counterStake >= MIN_COUNTER_STAKE, "counter stake too low");

        bytes32 disputeId = keccak256(abi.encodePacked(regId, msg.sender, block.timestamp));
        require(disputes[disputeId].disputer == address(0), "dispute exists");

        disputes[disputeId] = Dispute({
            disputer: msg.sender,
            regId: regId,
            counterStake: counterStake,
            openedAt: uint32(block.timestamp),
            status: 0,
            commitHash: pendingCommits[msg.sender],
            revealed: true
        });
        openDisputeCount[indexer] += 1;
        delete pendingCommits[msg.sender];

        IERC20(USDC).safeTransferFrom(msg.sender, address(this), counterStake);

        emit DisputeOpened(disputeId, regId, msg.sender);
    }

    /// @notice Indexer responds to a dispute by proving the queried event existed on-chain.
    /// @dev SIMPLIFIED proof verification. `beaconProof` is decoded as
    ///      (uint64 timestamp, bytes32 beaconRoot, bytes32 receiptsRoot, bytes32[] proof, uint256 index, bytes32 leaf)
    ///      and `receiptProof` carries the Merkle branch for the receipt leaf. We (1) confirm the
    ///      EIP-4788 precompile returns `beaconRoot` for `timestamp`, (2) confirm `beaconRoot`
    ///      commits to `receiptsRoot`, and (3) verify a keccak256 Merkle inclusion of `leaf` under
    ///      `receiptsRoot`.
    ///      NOTE: Production deployments should replace this with a full MPT verifier (RLP + Patricia
    ///      trie), e.g. Optimism's LibMPT. The simplified scheme here is NOT a sound consensus proof.
    // NOTE: _verifyBeaconProof uses a simplified (non-production) SSZ/MPT verifier.
    // Until replaced with a full verifier library, disputed queries always resolve as defaulted.
    // See GitHub issue #4: https://github.com/clawdbotatg/leftclaw-service-job-254/issues/4
    function respondDispute(bytes32 disputeId, bytes calldata receiptProof, bytes calldata beaconProof)
        external
        nonReentrant
    {
        Dispute storage d = disputes[disputeId];
        require(d.status == 0, "not open");
        require(block.timestamp <= uint256(d.openedAt) + DISPUTE_RESPONSE_SECS, "response window closed");

        bytes32 regId = d.regId;
        address indexer = regs[regId].indexer;
        require(msg.sender == indexer, "only indexer");

        require(_verifyBeaconProof(receiptProof, beaconProof), "invalid proof");

        // Effects.
        d.status = 1; // indexerWon
        regs[regId].disputesWon += 1;
        openDisputeCount[indexer] -= 1;
        uint96 counterStake = d.counterStake;
        d.counterStake = 0;
        address disputer = d.disputer;

        // The disputer lost: penalize them and distribute their counter-stake as a reward
        // rather than returning it. This makes the escalating-BPS deterrent live.
        lostDisputeCount[disputer] += 1;

        uint96 indexerReward;
        uint96 keeperReward;
        uint96 treasuryReward;
        if (counterStake > 0) {
            indexerReward = uint96((uint256(counterStake) * 7000) / 10000);
            keeperReward = uint96((uint256(counterStake) * 2000) / 10000);
            treasuryReward = counterStake - indexerReward - keeperReward;
        }

        // Interactions last.
        if (indexerReward > 0) IERC20(USDC).safeTransfer(indexer, indexerReward);
        if (keeperReward > 0) IERC20(USDC).safeTransfer(msg.sender, keeperReward);
        if (treasuryReward > 0) IERC20(USDC).safeTransfer(TREASURY, treasuryReward);

        emit DisputeResolved(disputeId, 1);
    }

    /// @dev SIMPLIFIED EIP-4788 + Merkle verification. See respondDispute NatSpec.
    ///      NOTE: Production deployments should replace this with a full MPT verifier (RLP + Patricia trie).
    function _verifyBeaconProof(bytes calldata receiptProof, bytes calldata beaconProof)
        internal
        view
        returns (bool)
    {
        // beaconProof: abi.encode(uint64 timestamp, bytes32 receiptsRoot, bytes32[] proof, uint256 index, bytes32 leaf)
        if (beaconProof.length < 64) return false;
        (uint64 timestamp, bytes32 receiptsRoot, bytes32[] memory proof, uint256 index, bytes32 leaf) =
            abi.decode(beaconProof, (uint64, bytes32, bytes32[], uint256, bytes32));

        // (1) Get beacon root from the EIP-4788 precompile.
        (bool ok, bytes memory result) = BEACON_ROOTS_ADDRESS.staticcall(abi.encode(uint256(timestamp)));
        if (!ok || result.length < 32) return false;
        bytes32 beaconRoot = abi.decode(result, (bytes32));

        // (2) Verify that receiptsRoot is committed in the beacon state.
        // NOTE: This is STILL SIMPLIFIED. Production must use full SSZ/MPT proof (Optimism LibMPT or equivalent).
        // For now, verify that keccak256(timestamp, receiptsRoot) is in the beacon root commitment chain.
        bytes32 commitment = keccak256(abi.encodePacked(bytes32(uint256(timestamp)), receiptsRoot));
        if (commitment != beaconRoot) {
            // If direct commitment fails, return false (production would do full SSZ proof).
            // NOTE: This means _verifyBeaconProof will fail for real proofs until replaced with a full SSZ/MPT verifier.
            // See GitHub issue #4 for production replacement requirements.
            return false;
        }

        // (3) Verify receipt is included in receiptsRoot via simple Merkle proof.
        return _verifyMerkle(proof, receiptsRoot, leaf, index);
    }

    /// @dev Standard ordered binary keccak256 Merkle inclusion check.
    function _verifyMerkle(bytes32[] memory proof, bytes32 root, bytes32 leaf, uint256 index)
        internal
        pure
        returns (bool)
    {
        bytes32 hash = leaf;
        uint256 idx = index;
        for (uint256 i = 0; i < proof.length; ++i) {
            bytes32 sibling = proof[i];
            if (idx & 1 == 0) {
                hash = keccak256(abi.encodePacked(hash, sibling));
            } else {
                hash = keccak256(abi.encodePacked(sibling, hash));
            }
            idx >>= 1;
        }
        return hash == root;
    }

    function resolveDefaulted(bytes32 disputeId) external nonReentrant {
        Dispute storage d = disputes[disputeId];
        require(d.status == 0, "not open");
        require(block.timestamp > uint256(d.openedAt) + DISPUTE_RESPONSE_SECS, "still responding");

        bytes32 regId = d.regId;
        RegData storage reg = regs[regId];
        address indexer = reg.indexer;
        address disputer = d.disputer;

        // Return the disputer's counter-stake (they won).
        uint96 counterStake = d.counterStake;
        d.counterStake = 0;

        // --- Slash boost (100%). ---
        uint96 slashBoost = reg.boostStake;
        uint96 boostDisputerShare;
        uint96 boostKeeperShare;
        uint96 boostTreasuryShare;
        if (slashBoost > 0) {
            reg.boostStake = 0;
            boostDisputerShare = uint96((uint256(slashBoost) * 7000) / 10000);
            boostKeeperShare = uint96((uint256(slashBoost) * 2000) / 10000);
            boostTreasuryShare = slashBoost - boostDisputerShare - boostKeeperShare;
            emit BoostStakeSlashed(regId, slashBoost);
        }

        // --- Slash base (20%). ---
        uint96 slashBase = uint96((uint256(baseStake[indexer]) * BASE_SLASH_PCT_BPS) / 10000);
        uint96 baseDisputerShare;
        uint96 baseKeeperShare;
        if (slashBase > 0) {
            baseStake[indexer] -= slashBase;
            baseDisputerShare = uint96((uint256(slashBase) * 8000) / 10000);
            baseKeeperShare = slashBase - baseDisputerShare;
            emit BaseStakeSlashed(indexer, slashBase);
        }

        if (baseStake[indexer] < MIN_BASE_STAKE_USDC) {
            baseSlashCount[indexer] += 1;
        }
        baseSlashCooldownUntil[indexer] = uint32(block.timestamp + BASE_SLASH_COOLDOWN_SECS);
        openDisputeCount[indexer] -= 1;
        d.status = 3; // defaulted
        reg.disputesLost += 1;
        // Disputer won; do NOT increment lostDisputeCount[disputer].

        // Interactions last.
        if (counterStake > 0) IERC20(USDC).safeTransfer(disputer, counterStake);
        if (boostDisputerShare > 0) IERC20(USDC).safeTransfer(disputer, boostDisputerShare);
        if (boostKeeperShare > 0) IERC20(USDC).safeTransfer(msg.sender, boostKeeperShare);
        if (boostTreasuryShare > 0) IERC20(USDC).safeTransfer(TREASURY, boostTreasuryShare);
        if (baseDisputerShare > 0) IERC20(USDC).safeTransfer(disputer, baseDisputerShare);
        if (baseKeeperShare > 0) IERC20(USDC).safeTransfer(msg.sender, baseKeeperShare);

        emit DisputeResolved(disputeId, 3);
    }

    /*//////////////////////////////////////////////////////////////
                                BUYBACK
    //////////////////////////////////////////////////////////////*/

    function executeBuyback(uint96 minClawdOut) external nonReentrant {
        uint96 amount = buybackReserveUSDC;
        require(amount > 0, "no reserve");
        buybackReserveUSDC = 0;

        uint256 balanceBefore = IERC20(CLAWD).balanceOf(DEAD_ADDRESS);

        IERC20(USDC).forceApprove(UNISWAP_V3_ROUTER, amount);
        ISwapRouter(UNISWAP_V3_ROUTER).exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: USDC,
                tokenOut: CLAWD,
                fee: POOL_FEE,
                recipient: DEAD_ADDRESS,
                amountIn: amount,
                amountOutMinimum: minClawdOut,
                sqrtPriceLimitX96: 0
            })
        );
        // Reset approval to avoid lingering allowance.
        IERC20(USDC).forceApprove(UNISWAP_V3_ROUTER, 0);

        uint256 balanceAfter = IERC20(CLAWD).balanceOf(DEAD_ADDRESS);
        uint256 clawdBurned = balanceAfter - balanceBefore; // fee-on-transfer guard
        require(clawdBurned >= minClawdOut, "slippage");

        emit BuybackExecuted(amount, clawdBurned);
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/

    function getReputation(bytes32 regId) external view returns (Reputation memory) {
        RegData storage reg = regs[regId];
        return Reputation({
            indexer: reg.indexer,
            boostStake: reg.boostStake,
            uniqueConsumers: reg.uniqueConsumers,
            totalQueries: reg.totalQueries,
            disputesLost: reg.disputesLost,
            disputesWon: reg.disputesWon,
            firstQueryTs: reg.firstQueryTs,
            reputationAge: reputationAge(regId)
        });
    }

    function reputationAge(bytes32 regId) public view returns (uint256) {
        uint32 first = regs[regId].firstQueryTs;
        if (first == 0 || block.timestamp <= first) return 0;
        return (block.timestamp - first) / 86400;
    }

    function getCounterStakeBps(address disputer) public view returns (uint16) {
        uint256 bps = uint256(DISPUTE_COUNTER_STAKE_BPS) + uint256(lostDisputeCount[disputer]) * 500;
        if (bps > 5000) bps = 5000;
        return uint16(bps);
    }
}
