// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./DeployHelpers.s.sol";
import "../contracts/PermissionlessIndexer.sol";

/**
 * @notice Deploy script for the PermissionlessIndexer contract.
 * @dev Inherits ScaffoldETHDeploy which provides the `deployer` account and the
 *      ScaffoldEthDeployerRunner modifier. The protocol is fully permissionless —
 *      there is no ownership to transfer after deployment.
 *
 * Example:
 *   yarn deploy --file DeployPermissionlessIndexer.s.sol
 *   yarn deploy --file DeployPermissionlessIndexer.s.sol --network base
 */
contract DeployPermissionlessIndexer is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner {
        address treasury = 0xCfB32a7d01Ca2B4B538C83B2b38656D3502D76EA; // client wallet
        address uniswapPool = 0x542d07e51DEf4250390f3E47c9aE9848eEc0AF5D;

        new PermissionlessIndexer(treasury, uniswapPool);

        // No ownership to transfer — contract is permissionless.
    }
}
