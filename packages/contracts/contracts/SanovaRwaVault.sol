// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface ISanovaKycAsset {
    function kycApproved(address account) external view returns (bool);
}

/// @notice ERC-4626 vault over SanovaAssetToken for DeFi-compatible RWA shares (Centrifuge-ready pattern).
contract SanovaRwaVault is ERC4626, Ownable {
    ISanovaKycAsset public immutable kycAsset;

    constructor(
        IERC20 asset_,
        string memory name_,
        string memory symbol_,
        address initialOwner
    ) ERC4626(asset_) ERC20(name_, symbol_) Ownable(initialOwner) {
        kycAsset = ISanovaKycAsset(address(asset_));
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
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
    ) internal override {
        require(kycAsset.kycApproved(caller), "SANOVA: withdraw KYC required");
        require(kycAsset.kycApproved(receiver), "SANOVA: receiver KYC required");
        require(kycAsset.kycApproved(owner), "SANOVA: owner KYC required");
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            require(kycAsset.kycApproved(from) && kycAsset.kycApproved(to), "SANOVA: share transfer requires KYC");
        }
        super._update(from, to, value);
    }
}
