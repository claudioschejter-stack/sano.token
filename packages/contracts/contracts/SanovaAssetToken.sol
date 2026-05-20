// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SanovaAssetToken is ERC20, Ownable {
    mapping(address => bool) public kycApproved;

    event KycUpdated(address indexed account, bool approved);

    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner
    ) ERC20(name_, symbol_) Ownable(initialOwner) {
        kycApproved[initialOwner] = true;
        emit KycUpdated(initialOwner, true);
    }

    function setKyc(address account, bool approved) external onlyOwner {
        kycApproved[account] = approved;
        emit KycUpdated(account, approved);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        require(kycApproved[to], "SANOVA: receiver KYC required");
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            require(kycApproved[from] && kycApproved[to], "SANOVA: transfer requires KYC");
        }
        super._update(from, to, value);
    }
}
