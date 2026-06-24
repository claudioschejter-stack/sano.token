// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

interface IERC4626Nav {
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
}

/// @notice Morpho-compatible NAV oracle for ERC-4626 RWA vault collateral.
/// @dev Combines on-chain ERC-4626 exchange rate with auditor-updated NAV per underlying asset.
///      Returns the price of 1 vault share quoted in USDC, scaled per Morpho (1e36 base).
///      Formula: price = convertToAssets(1e18) * navPerAssetMicroUsd * 1e18 / 1e18 / 1e6
///
///      Security model:
///      - NAV updates go through a 24h timelock (proposeNav → commitPendingNav) after setup.
///      - Circuit breaker: updates exceeding 20% from current NAV are rejected to block manipulation.
///      - During the 1-hour setup window, updateNav applies immediately for initial configuration.
///      - Pausable: owner can pause price() reads during maintenance or emergency.
contract SanovaNavOracle is Ownable, Pausable {
    IERC4626Nav public immutable vault;

    /// @dev Audited NAV per 1 underlying asset token (18 decimals), in USDC micro-units (6 decimals).
    uint256 public navPerAssetMicroUsd;
    address public updater;
    uint256 public lastNavUpdateAt;
    bytes32 public lastAuditHash;

    /// @dev Initial grace window for configuration — no timelock enforced.
    uint256 public immutable setupExpiresAt;

    /// @dev Minimum delay between a NAV proposal and its activation.
    uint256 public constant NAV_TIMELOCK = 24 hours;

    /// @dev Maximum allowed single-update price change in basis points (2000 = 20%).
    uint256 public constant MAX_NAV_CHANGE_BPS = 2000;

    struct PendingNavUpdate {
        uint256 navPerAssetMicroUsd;
        bytes32 auditHash;
        uint256 effectiveAt;
    }
    PendingNavUpdate public pendingNavUpdate;

    uint256 private constant MORPHO_PRICE_MULTIPLIER = 1e18;
    uint256 private constant SHARE_UNIT = 1e18;

    event NavUpdated(uint256 navPerAssetMicroUsd, bytes32 auditHash, uint256 timestamp, address indexed updater);
    event NavUpdateProposed(uint256 navPerAssetMicroUsd, bytes32 auditHash, uint256 effectiveAt, address indexed proposer);
    event NavUpdateCancelled(address indexed cancelledBy);
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
        setupExpiresAt = block.timestamp + 1 hours;
    }

    // ─────────────────────────────────────────────────────────────────
    //  Price read (used by Morpho Blue)
    // ─────────────────────────────────────────────────────────────────

    /// @notice Morpho Blue oracle interface — price of 1 collateral share in USDC, scaled 1e36.
    function price() external view whenNotPaused returns (uint256) {
        uint256 assetsPerShare = vault.convertToAssets(SHARE_UNIT);
        uint256 valueMicroUsd = (assetsPerShare * navPerAssetMicroUsd) / SHARE_UNIT;
        return valueMicroUsd * MORPHO_PRICE_MULTIPLIER;
    }

    // ─────────────────────────────────────────────────────────────────
    //  NAV update (two-phase after setup window)
    // ─────────────────────────────────────────────────────────────────

    /// @notice Propose a NAV update.
    /// @dev During setup window (first 1h after deploy): applies immediately.
    ///      After setup window: schedules the update with NAV_TIMELOCK delay.
    ///      Circuit breaker: reverts if the proposed change exceeds MAX_NAV_CHANGE_BPS from current.
    function updateNav(uint256 navPerAssetMicroUsd_, bytes32 auditHash) external {
        require(msg.sender == updater || msg.sender == owner(), "SANOVA: not authorized");
        require(navPerAssetMicroUsd_ > 0, "SANOVA: invalid NAV");

        // Circuit breaker: reject updates that move price by more than 20%
        if (navPerAssetMicroUsd > 0) {
            uint256 current = navPerAssetMicroUsd;
            uint256 delta = navPerAssetMicroUsd_ > current
                ? navPerAssetMicroUsd_ - current
                : current - navPerAssetMicroUsd_;
            require(
                delta * 10000 / current <= MAX_NAV_CHANGE_BPS,
                "SANOVA: NAV change exceeds 20% circuit breaker"
            );
        }

        // Setup window: apply immediately (allows initial bootstrapping)
        if (block.timestamp <= setupExpiresAt) {
            _applyNav(navPerAssetMicroUsd_, auditHash);
            return;
        }

        // Production: queue with 24h timelock
        uint256 effectiveAt = block.timestamp + NAV_TIMELOCK;
        pendingNavUpdate = PendingNavUpdate({
            navPerAssetMicroUsd: navPerAssetMicroUsd_,
            auditHash: auditHash,
            effectiveAt: effectiveAt
        });
        emit NavUpdateProposed(navPerAssetMicroUsd_, auditHash, effectiveAt, msg.sender);
    }

    /// @notice Commit a pending NAV update once the timelock has elapsed.
    /// @dev Callable by anyone — permissionless commit once 24h have passed.
    function commitPendingNav() external {
        PendingNavUpdate memory pending = pendingNavUpdate;
        require(pending.effectiveAt != 0, "SANOVA: no pending update");
        require(block.timestamp >= pending.effectiveAt, "SANOVA: timelock not elapsed");

        delete pendingNavUpdate;
        _applyNav(pending.navPerAssetMicroUsd, pending.auditHash);
    }

    /// @notice Cancel a pending NAV update before it becomes effective. Owner only.
    function cancelPendingNav() external onlyOwner {
        delete pendingNavUpdate;
        emit NavUpdateCancelled(msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────
    //  Admin
    // ─────────────────────────────────────────────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setUpdater(address newUpdater) external onlyOwner {
        require(newUpdater != address(0), "SANOVA: zero updater");
        address previous = updater;
        updater = newUpdater;
        emit UpdaterChanged(previous, newUpdater);
    }

    // ─────────────────────────────────────────────────────────────────
    //  Internal
    // ─────────────────────────────────────────────────────────────────

    function _applyNav(uint256 nav_, bytes32 auditHash) internal {
        navPerAssetMicroUsd = nav_;
        lastAuditHash = auditHash;
        lastNavUpdateAt = block.timestamp;
        emit NavUpdated(nav_, auditHash, block.timestamp, msg.sender);
    }
}
