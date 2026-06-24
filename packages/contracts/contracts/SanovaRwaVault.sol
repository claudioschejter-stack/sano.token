// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

interface ISanovaKycAsset {
    function kycApproved(address account) external view returns (bool);
}

/// @notice ERC-4626 vault over SanovaAssetToken for DeFi-compatible RWA shares (Centrifuge-ready pattern).
contract SanovaRwaVault is ERC4626, Ownable, Pausable {
    ISanovaKycAsset public immutable kycAsset;
    mapping(address => bool) public externalContractAllowed;
    mapping(bytes32 => uint256) public adminActionReadyAt;
    mapping(uint256 => uint256) public withdrawnAssetsByDay;

    uint256 public immutable setupExpiresAt;
    uint256 public adminActionDelay;
    uint256 public dailyWithdrawalLimit;

    event ExternalContractAllowed(address indexed account, bool allowed);
    event AdminActionScheduled(bytes32 indexed actionId, uint256 readyAt);
    event AdminActionDelayUpdated(uint256 delaySeconds);
    event DailyWithdrawalLimitUpdated(uint256 limit);

    constructor(
        IERC20 asset_,
        string memory name_,
        string memory symbol_,
        address initialOwner
    ) ERC4626(asset_) ERC20(name_, symbol_) Ownable(initialOwner) {
        kycAsset = ISanovaKycAsset(address(asset_));
        externalContractAllowed[initialOwner] = true;
        setupExpiresAt = block.timestamp + 1 hours;
        adminActionDelay = 24 hours;
        dailyWithdrawalLimit = type(uint256).max;
        emit ExternalContractAllowed(initialOwner, true);
    }

    modifier onlyAfterTimelock(bytes32 actionId) {
        if (block.timestamp > setupExpiresAt) {
            uint256 readyAt = adminActionReadyAt[actionId];
            require(readyAt != 0 && block.timestamp >= readyAt, "SANOVA: admin timelock pending");
            delete adminActionReadyAt[actionId];
        }
        _;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner onlyAfterTimelock(keccak256("UNPAUSE")) {
        _unpause();
    }

    function scheduleAdminAction(bytes32 actionId) external onlyOwner {
        uint256 readyAt = block.timestamp + adminActionDelay;
        adminActionReadyAt[actionId] = readyAt;
        emit AdminActionScheduled(actionId, readyAt);
    }

    function setAdminActionDelay(uint256 delaySeconds)
        external
        onlyOwner
        onlyAfterTimelock(keccak256("SET_ADMIN_ACTION_DELAY"))
    {
        require(delaySeconds >= 1 hours && delaySeconds <= 7 days, "SANOVA: invalid delay");
        adminActionDelay = delaySeconds;
        emit AdminActionDelayUpdated(delaySeconds);
    }

    function setExternalContractAllowed(address account, bool allowed)
        external
        onlyOwner
        onlyAfterTimelock(keccak256(abi.encode("SET_EXTERNAL_CONTRACT_ALLOWED", account, allowed)))
    {
        externalContractAllowed[account] = allowed;
        emit ExternalContractAllowed(account, allowed);
    }

    function setDailyWithdrawalLimit(uint256 limit)
        external
        onlyOwner
        onlyAfterTimelock(keccak256(abi.encode("SET_DAILY_WITHDRAWAL_LIMIT", limit)))
    {
        dailyWithdrawalLimit = limit;
        emit DailyWithdrawalLimitUpdated(limit);
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override whenNotPaused {
        require(kycAsset.kycApproved(caller), "SANOVA: depositor KYC required");
        require(kycAsset.kycApproved(receiver), "SANOVA: receiver KYC required");
        super._deposit(caller, receiver, assets, shares);
    }

    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal override whenNotPaused {
        require(kycAsset.kycApproved(caller), "SANOVA: withdraw KYC required");
        require(kycAsset.kycApproved(receiver), "SANOVA: receiver KYC required");
        require(kycAsset.kycApproved(owner), "SANOVA: owner KYC required");
        uint256 day = block.timestamp / 1 days;
        uint256 nextWithdrawn = withdrawnAssetsByDay[day] + assets;
        require(nextWithdrawn <= dailyWithdrawalLimit, "SANOVA: daily withdrawal limit");
        withdrawnAssetsByDay[day] = nextWithdrawn;
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    /// @dev Inflation attack mitigation (EIP-4626 virtual shares).
    ///      A 3-decimal offset makes the attack cost 1000× more expensive for any attacker.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 3;
    }

    function _update(address from, address to, uint256 value) internal override whenNotPaused {
        if (from != address(0) && to != address(0)) {
            require(kycAsset.kycApproved(from) && kycAsset.kycApproved(to), "SANOVA: share transfer requires KYC");
        }
        if (from != address(0) && from.code.length > 0) {
            require(externalContractAllowed[from], "SANOVA: contract sender not allowed");
        }
        if (to != address(0) && to.code.length > 0) {
            require(externalContractAllowed[to], "SANOVA: contract receiver not allowed");
        }
        super._update(from, to, value);
    }
}
