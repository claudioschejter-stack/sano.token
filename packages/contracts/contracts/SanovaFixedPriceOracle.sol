// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal Morpho-compatible oracle for fixed-price RWA vault collateral.
/// @dev Returns the price of 1 collateral token quoted in loan token units, scaled by 1e36.
contract SanovaFixedPriceOracle {
    uint256 private immutable _price;

    constructor(uint256 price_) {
        require(price_ > 0, "SANOVA: invalid oracle price");
        _price = price_;
    }

    function price() external view returns (uint256) {
        return _price;
    }
}
