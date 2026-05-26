// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract SanovaAssetToken is ERC20, Ownable, Pausable {
    mapping(address => bool) public kycApproved;
    mapping(address => bool) public externalContractAllowed;
    mapping(bytes32 => uint256) public adminActionReadyAt;

    uint256 public immutable setupExpiresAt;
    uint256 public adminActionDelay;

    event KycUpdated(address indexed account, bool approved);
    event ExternalContractAllowed(address indexed account, bool allowed);
    event AdminActionScheduled(bytes32 indexed actionId, uint256 readyAt);
    event AdminActionDelayUpdated(uint256 delaySeconds);

    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner
    ) ERC20(name_, symbol_) Ownable(initialOwner) {
        kycApproved[initialOwner] = true;
        externalContractAllowed[initialOwner] = true;
        setupExpiresAt = block.timestamp + 1 hours;
        adminActionDelay = 24 hours;
        emit KycUpdated(initialOwner, true);
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

    function setKyc(address account, bool approved) external onlyOwner {
        bytes32 actionId = keccak256(abi.encode("SET_KYC", account, approved));
        if (block.timestamp > setupExpiresAt) {
            uint256 readyAt = adminActionReadyAt[actionId];
            require(readyAt != 0 && block.timestamp >= readyAt, "SANOVA: KYC timelock pending");
            delete adminActionReadyAt[actionId];
        }
        kycApproved[account] = approved;
        emit KycUpdated(account, approved);
    }

    function setExternalContractAllowed(address account, bool allowed)
        external
        onlyOwner
        onlyAfterTimelock(keccak256(abi.encode("SET_EXTERNAL_CONTRACT_ALLOWED", account, allowed)))
    {
        externalContractAllowed[account] = allowed;
        emit ExternalContractAllowed(account, allowed);
    }

    function mint(address to, uint256 amount)
        external
        onlyOwner
        onlyAfterTimelock(keccak256(abi.encode("MINT", to, amount)))
    {
        require(kycApproved[to], "SANOVA: receiver KYC required");
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override whenNotPaused {
        if (from != address(0) && to != address(0)) {
            require(kycApproved[from] && kycApproved[to], "SANOVA: transfer requires KYC");
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
