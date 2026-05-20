// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @notice Adaptador mínimo hacia protocolos de lending externos (Aave, Compound, etc.).
 */
interface IExternalLendingAdapter {
    function repayOnBehalf(address borrower, uint256 amount) external returns (uint256 repaid);
}

/**
 * @title SanovaDividendRouter
 * @dev Intercepta dividendos en stablecoin y canaliza el flujo hacia amortización automática
 *      de deuda de margen vía adaptadores de lending externos.
 */
contract SanovaDividendRouter is Ownable, ReentrancyGuard {
    IERC20 public immutable stablecoin;

    mapping(address => address) public lendingAdapterByInvestor;
    mapping(address => uint256) public trackedMarginDebt;

    event DividendRouted(
        address indexed investor,
        uint256 grossAmount,
        uint256 repaidToLending,
        uint256 cashToInvestor,
        address adapter
    );
    event LendingAdapterSet(address indexed investor, address adapter);
    event MarginDebtUpdated(address indexed investor, uint256 debtAmount);

    constructor(address stablecoin_, address initialOwner) Ownable(initialOwner) {
        require(stablecoin_ != address(0), "SANOVA: invalid stablecoin");
        stablecoin = IERC20(stablecoin_);
    }

    function setLendingAdapter(address investor, address adapter) external onlyOwner {
        require(investor != address(0), "SANOVA: invalid investor");
        lendingAdapterByInvestor[investor] = adapter;
        emit LendingAdapterSet(investor, adapter);
    }

    function setTrackedMarginDebt(address investor, uint256 debtAmount) external onlyOwner {
        require(investor != address(0), "SANOVA: invalid investor");
        trackedMarginDebt[investor] = debtAmount;
        emit MarginDebtUpdated(investor, debtAmount);
    }

    /**
     * @notice Recibe stablecoin del operador y ejecuta auto-repay antes de liberar excedente.
     */
    function routeDividendAndAutoRepay(
        address investor,
        uint256 dividendAmount
    ) external onlyOwner nonReentrant returns (uint256 repaidAmount, uint256 cashAmount) {
        require(investor != address(0), "SANOVA: invalid investor");
        require(dividendAmount > 0, "SANOVA: zero dividend");

        require(
            stablecoin.transferFrom(msg.sender, address(this), dividendAmount),
            "SANOVA: dividend transfer failed"
        );

        uint256 outstanding = trackedMarginDebt[investor];
        if (outstanding > 0) {
            repaidAmount = dividendAmount > outstanding ? outstanding : dividendAmount;
            address adapter = lendingAdapterByInvestor[investor];

            if (adapter != address(0) && repaidAmount > 0) {
                require(
                    stablecoin.approve(adapter, repaidAmount),
                    "SANOVA: adapter approval failed"
                );
                uint256 actualRepaid = IExternalLendingAdapter(adapter).repayOnBehalf(investor, repaidAmount);
                repaidAmount = actualRepaid > repaidAmount ? repaidAmount : actualRepaid;
            }

            trackedMarginDebt[investor] = outstanding - repaidAmount;
            emit MarginDebtUpdated(investor, trackedMarginDebt[investor]);
        }

        cashAmount = dividendAmount - repaidAmount;
        if (cashAmount > 0) {
            require(stablecoin.transfer(investor, cashAmount), "SANOVA: cash payout failed");
        }

        emit DividendRouted(investor, dividendAmount, repaidAmount, cashAmount, lendingAdapterByInvestor[investor]);
    }
}
