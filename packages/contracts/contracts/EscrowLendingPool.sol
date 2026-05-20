// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract EscrowLendingPool is Ownable, ReentrancyGuard {
    IERC20 public immutable collateralToken;
    IERC20 public immutable liquidityAsset;
    uint256 public maxLtvBps;

    struct Position {
        uint256 collateralAmount;
        uint256 debtAmount;
        bool active;
    }

    mapping(address => Position) public positions;

    event CollateralLocked(address indexed borrower, uint256 amount);
    event LoanIssued(address indexed borrower, uint256 amount);
    event LoanRepaid(address indexed borrower, uint256 amount);
    event CollateralReleased(address indexed borrower, uint256 amount);
    event MaxLtvUpdated(uint256 maxLtvBps);
    event YieldDistributedAndAmortized(
        address indexed borrower,
        uint256 yieldAmount,
        uint256 amortizedAmount,
        uint256 cashAmount
    );

    constructor(
        address collateralToken_,
        address liquidityAsset_,
        uint256 maxLtvBps_,
        address initialOwner
    ) Ownable(initialOwner) {
        require(collateralToken_ != address(0), "SANOVA: invalid collateral");
        require(liquidityAsset_ != address(0), "SANOVA: invalid liquidity");
        require(maxLtvBps_ <= 10_000, "SANOVA: invalid LTV");

        collateralToken = IERC20(collateralToken_);
        liquidityAsset = IERC20(liquidityAsset_);
        maxLtvBps = maxLtvBps_;
    }

    function setMaxLtv(uint256 maxLtvBps_) external onlyOwner {
        require(maxLtvBps_ <= 10_000, "SANOVA: invalid LTV");
        maxLtvBps = maxLtvBps_;
        emit MaxLtvUpdated(maxLtvBps_);
    }

    function lockCollateral(uint256 amount) external nonReentrant {
        require(amount > 0, "SANOVA: zero collateral");

        Position storage position = positions[msg.sender];
        position.collateralAmount += amount;
        position.active = true;

        require(
            collateralToken.transferFrom(msg.sender, address(this), amount),
            "SANOVA: collateral transfer failed"
        );

        emit CollateralLocked(msg.sender, amount);
    }

    function issueLoan(address borrower, uint256 amount) external onlyOwner nonReentrant {
        Position storage position = positions[borrower];
        require(position.active, "SANOVA: no position");
        require(amount > 0, "SANOVA: zero debt");

        position.debtAmount += amount;
        require(liquidityAsset.transfer(borrower, amount), "SANOVA: loan transfer failed");

        emit LoanIssued(borrower, amount);
    }

    function repay(uint256 amount) external nonReentrant {
        Position storage position = positions[msg.sender];
        require(position.debtAmount >= amount && amount > 0, "SANOVA: invalid repay");

        position.debtAmount -= amount;
        require(
            liquidityAsset.transferFrom(msg.sender, address(this), amount),
            "SANOVA: repay transfer failed"
        );

        emit LoanRepaid(msg.sender, amount);
    }

    /**
     * @notice Distribuye rendimiento en la moneda de liquidez y amortiza deuda primero.
     * @dev Flujo contable:
     *      1. El operador transfiere `yieldAmount` al pool.
     *      2. El pool descuenta deuda pendiente del borrower.
     *      3. El excedente se paga como caja líquida al borrower.
     */
    function distributeYieldAndAmortize(
        address borrower,
        uint256 yieldAmount
    ) external onlyOwner nonReentrant returns (uint256 amortizedAmount, uint256 cashAmount) {
        require(borrower != address(0), "SANOVA: invalid borrower");
        require(yieldAmount > 0, "SANOVA: zero yield");

        Position storage position = positions[borrower];
        require(position.active, "SANOVA: no position");

        require(
            liquidityAsset.transferFrom(msg.sender, address(this), yieldAmount),
            "SANOVA: yield transfer failed"
        );

        uint256 outstandingDebt = position.debtAmount;
        if (outstandingDebt > 0) {
            amortizedAmount = yieldAmount > outstandingDebt ? outstandingDebt : yieldAmount;
            position.debtAmount = outstandingDebt - amortizedAmount;
            emit LoanRepaid(borrower, amortizedAmount);
        }

        cashAmount = yieldAmount - amortizedAmount;
        if (cashAmount > 0) {
            require(liquidityAsset.transfer(borrower, cashAmount), "SANOVA: cash transfer failed");
        }

        emit YieldDistributedAndAmortized(borrower, yieldAmount, amortizedAmount, cashAmount);
    }

    function releaseCollateral(uint256 amount) external nonReentrant {
        Position storage position = positions[msg.sender];
        require(position.debtAmount == 0, "SANOVA: debt outstanding");
        require(position.collateralAmount >= amount && amount > 0, "SANOVA: invalid release");

        position.collateralAmount -= amount;
        if (position.collateralAmount == 0) {
            position.active = false;
        }

        require(collateralToken.transfer(msg.sender, amount), "SANOVA: release failed");
        emit CollateralReleased(msg.sender, amount);
    }
}
