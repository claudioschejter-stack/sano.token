// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IERC4626Nav {
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
}

/// @notice Morpho-compatible NAV oracle for ERC-4626 RWA vault collateral.
/// @dev Combines on-chain ERC-4626 exchange rate with auditor-updated NAV per underlying asset.
///      Returns the price of 1 vault share quoted in USDC, scaled per Morpho (1e36 base).
///      Formula: price = convertToAssets(1e18) * navPerAssetMicroUsd * 1e18 / 1e18 / 1e6
///      where navPerAssetMicroUsd is the audited USD value per 1 underlying asset (6 decimals).
contract SanovaNavOracle is Ownable {
    IERC4626Nav public immutable vault;

    /// @dev Audited NAV per 1 underlying asset token (18 decimals), in USDC micro-units (6 decimals).
    uint256 public navPerAssetMicroUsd;
    address public updater;
    uint256 public lastNavUpdateAt;
    bytes32 public lastAuditHash;

    /// @dev Morpho scale factor: 10^(36 + loanDecimals(6) - collateralDecimals(18)) = 1e24, applied as microUsd * 1e18.
    uint256 private constant MORPHO_PRICE_MULTIPLIER = 1e18;
    uint256 private constant SHARE_UNIT = 1e18;

    event NavUpdated(uint256 navPerAssetMicroUsd, bytes32 auditHash, uint256 timestamp, address indexed updater);
    event UpdaterChanged(address indexed previousUpdater, address indexed newUpdater);

    constructor(
        address vault_,
        uint256 navPerAssetMicroUsd_,
        address updater_,
        address initialOwner
    ) Ownable(initialOwner) {
        require(vault_ != address(0), "SANOVA: zero vault");
        require(navPerAssetMicroUsd_ > 0, "SANOVA: invalid NAV");
        require(updater_ != address(0), "SANOVA: zero updater");

        vault = IERC4626Nav(vault_);
        navPerAssetMicroUsd = navPerAssetMicroUsd_;
        updater = updater_;
        lastNavUpdateAt = block.timestamp;
    }

    /// @notice Morpho Blue oracle interface — price of 1 collateral token in loan token units, scaled 1e36.
    function price() external view returns (uint256) {
        uint256 assetsPerShare = vault.convertToAssets(SHARE_UNIT);
        uint256 valueMicroUsd = (assetsPerShare * navPerAssetMicroUsd) / SHARE_UNIT;
        return valueMicroUsd * MORPHO_PRICE_MULTIPLIER;
    }

    /// @notice Update audited NAV after physical property appraisal.
    /// @param navPerAssetMicroUsd_ NAV per underlying asset in USDC micro-units (6 decimals).
    /// @param auditHash IPFS or document hash of the audit report for transparency.
    function updateNav(uint256 navPerAssetMicroUsd_, bytes32 auditHash) external {
        require(msg.sender == updater || msg.sender == owner(), "SANOVA: not authorized");
        require(navPerAssetMicroUsd_ > 0, "SANOVA: invalid NAV");

        navPerAssetMicroUsd = navPerAssetMicroUsd_;
        lastAuditHash = auditHash;
        lastNavUpdateAt = block.timestamp;

        emit NavUpdated(navPerAssetMicroUsd_, auditHash, block.timestamp, msg.sender);
    }

    function setUpdater(address newUpdater) external onlyOwner {
        require(newUpdater != address(0), "SANOVA: zero updater");
        address previous = updater;
        updater = newUpdater;
        emit UpdaterChanged(previous, newUpdater);
    }
}
