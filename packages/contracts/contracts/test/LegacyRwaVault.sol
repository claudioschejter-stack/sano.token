// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface ILegacyKycAsset {
    function kycApproved(address account) external view returns (bool);
}

/**
 * @notice The vault as it was deployed to production, for migration tests.
 *
 * Two differences from the current `SanovaRwaVault`, and they are the whole
 * reason the migration exists:
 *  - no `_decimalsOffset`, so shares carry 18 decimals instead of 21;
 *  - the contract-code checks apply to every address, including holders that KYC
 *    has already cleared, which is what rejected the investors' own wallets.
 *
 * Trimmed to what a migration touches: deposit, redeem, transfer and the
 * allowlist. No pause, no timelock, no withdrawal limit.
 */
contract LegacyRwaVault is ERC4626, Ownable {
    ILegacyKycAsset public immutable kycAsset;
    mapping(address => bool) public externalContractAllowed;

    constructor(
        IERC20 asset_,
        string memory name_,
        string memory symbol_,
        address initialOwner
    ) ERC4626(asset_) ERC20(name_, symbol_) Ownable(initialOwner) {
        kycAsset = ILegacyKycAsset(address(asset_));
        externalContractAllowed[initialOwner] = true;
    }

    function setExternalContractAllowed(address account, bool allowed) external onlyOwner {
        externalContractAllowed[account] = allowed;
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
            require(
                kycAsset.kycApproved(from) && kycAsset.kycApproved(to),
                "SANOVA: share transfer requires KYC"
            );
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
