// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SanovaAMM
 * @dev Pool de liquidez instantánea para el marketplace secundario.
 *      Los inversores venden tokens RWA a la tesorería con un spread de descuento configurable.
 */
contract SanovaAMM is Ownable, ReentrancyGuard {
    IERC20 public immutable propertyToken;
    IERC20 public immutable payoutStable;
    address public treasury;

    /// @dev Precio por token en unidades de stablecoin (ej. 6 decimales USDC).
    uint256 public tokenUnitPrice;
    /// @dev Descuento en basis points (300 = 3%).
    uint256 public discountBps;

    event InstantSale(
        address indexed seller,
        uint256 tokenAmount,
        uint256 grossStable,
        uint256 netStable,
        uint256 discountBpsApplied
    );
    event DiscountBpsUpdated(uint256 discountBps);
    event TokenUnitPriceUpdated(uint256 tokenUnitPrice);
    event TreasuryUpdated(address treasury);

    constructor(
        address propertyToken_,
        address payoutStable_,
        address treasury_,
        uint256 tokenUnitPrice_,
        uint256 discountBps_,
        address initialOwner
    ) Ownable(initialOwner) {
        require(propertyToken_ != address(0), "SANOVA: invalid token");
        require(payoutStable_ != address(0), "SANOVA: invalid stable");
        require(treasury_ != address(0), "SANOVA: invalid treasury");
        require(discountBps_ <= 10_000, "SANOVA: invalid discount");

        propertyToken = IERC20(propertyToken_);
        payoutStable = IERC20(payoutStable_);
        treasury = treasury_;
        tokenUnitPrice = tokenUnitPrice_;
        discountBps = discountBps_;
    }

    function setDiscountBps(uint256 discountBps_) external onlyOwner {
        require(discountBps_ <= 10_000, "SANOVA: invalid discount");
        discountBps = discountBps_;
        emit DiscountBpsUpdated(discountBps_);
    }

    function setTokenUnitPrice(uint256 tokenUnitPrice_) external onlyOwner {
        require(tokenUnitPrice_ > 0, "SANOVA: zero price");
        tokenUnitPrice = tokenUnitPrice_;
        emit TokenUnitPriceUpdated(tokenUnitPrice_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        require(treasury_ != address(0), "SANOVA: invalid treasury");
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    /**
     * @notice Venta instantánea de tokens hacia la tesorería con descuento aplicado.
     */
    function sellToTreasury(uint256 tokenAmount) external nonReentrant returns (uint256 netPayout) {
        require(tokenAmount > 0, "SANOVA: zero amount");

        uint256 grossStable = tokenAmount * tokenUnitPrice;
        netPayout = (grossStable * (10_000 - discountBps)) / 10_000;

        require(
            propertyToken.transferFrom(msg.sender, treasury, tokenAmount),
            "SANOVA: token transfer failed"
        );
        // `treasury` is an admin-configured contract state variable (not caller-controlled),
        // which must pre-approve this AMM to fund instant-sale payouts; this is not an
        // arbitrary third party.
        // slither-disable-next-line arbitrary-send-erc20
        require(
            payoutStable.transferFrom(treasury, msg.sender, netPayout),
            "SANOVA: stable payout failed"
        );

        emit InstantSale(msg.sender, tokenAmount, grossStable, netPayout, discountBps);
    }

    function quoteInstantSale(uint256 tokenAmount) external view returns (uint256 grossStable, uint256 netPayout) {
        grossStable = tokenAmount * tokenUnitPrice;
        netPayout = (grossStable * (10_000 - discountBps)) / 10_000;
    }
}
