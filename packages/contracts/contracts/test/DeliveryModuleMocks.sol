// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @dev Minimal stand-in for the parts of a Safe the delivery module touches.
contract MockSafeModuleHost {
    error CallFailed();

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes calldata data,
        uint8
    ) external returns (bool success) {
        (success, ) = to.call{value: value}(data);
    }

    /// @dev Lets tests drive the Safe-only setters without a real multisig.
    function callModule(address module, bytes calldata data) external {
        (bool ok, ) = module.call(data);
        if (!ok) revert CallFailed();
    }
}

/// @dev Asset token reduced to the whitelist the module reads.
contract MockKycToken {
    mapping(address => bool) public kycApproved;

    function setKyc(address account, bool approved) external {
        kycApproved[account] = approved;
    }
}

/// @dev ERC-20 share token reduced to what delivery needs.
contract MockShareToken {
    mapping(address => uint256) public balanceOf;

    error InsufficientBalance();

    constructor(address holder, uint256 supply) {
        balanceOf[holder] = supply;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance();
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
