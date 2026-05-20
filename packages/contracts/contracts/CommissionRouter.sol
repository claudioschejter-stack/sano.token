// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CommissionRouter
 * @dev Distribución multinivel de comisiones al momento de la compra.
 *      Soporta Fee Upfront (cobro inmediato) o Fee Residual (acumulado para liquidación futura).
 */
contract CommissionRouter is Ownable, ReentrancyGuard {
    enum FeeModel {
        UPFRONT,
        RESIDUAL
    }

    struct CommissionRecipient {
        address wallet;
        uint16 bps;
    }

    IERC20 public immutable settlementToken;

    mapping(address => uint256) public residualBalances;

    event PurchaseCommissionDistributed(
        bytes32 indexed purchaseId,
        uint256 grossAmount,
        FeeModel feeModel,
        uint256 totalCommission
    );
    event ResidualWithdrawn(address indexed recipient, uint256 amount);

    constructor(address settlementToken_, address initialOwner) Ownable(initialOwner) {
        require(settlementToken_ != address(0), "SANOVA: invalid token");
        settlementToken = IERC20(settlementToken_);
    }

    /**
     * @notice Separa comisiones de una compra según el modelo elegido.
     * @param recipients Lista ordenada de beneficiarios (asesores upline, plataforma, etc.).
     */
    function distributePurchaseCommission(
        bytes32 purchaseId,
        uint256 grossAmount,
        FeeModel feeModel,
        CommissionRecipient[] calldata recipients
    ) external onlyOwner nonReentrant returns (uint256 totalCommission) {
        require(grossAmount > 0, "SANOVA: zero gross");
        require(recipients.length > 0, "SANOVA: no recipients");

        uint256 allocatedBps;
        for (uint256 i = 0; i < recipients.length; i++) {
            CommissionRecipient calldata entry = recipients[i];
            require(entry.wallet != address(0), "SANOVA: invalid wallet");
            require(entry.bps > 0, "SANOVA: zero bps");
            allocatedBps += entry.bps;

            uint256 slice = (grossAmount * entry.bps) / 10_000;
            totalCommission += slice;

            if (feeModel == FeeModel.UPFRONT) {
                require(
                    settlementToken.transferFrom(msg.sender, entry.wallet, slice),
                    "SANOVA: upfront transfer failed"
                );
            } else {
                residualBalances[entry.wallet] += slice;
            }
        }

        require(allocatedBps <= 10_000, "SANOVA: commission overflow");

        emit PurchaseCommissionDistributed(purchaseId, grossAmount, feeModel, totalCommission);
    }

    function withdrawResidual(uint256 amount) external nonReentrant {
        require(amount > 0, "SANOVA: zero withdraw");
        uint256 balance = residualBalances[msg.sender];
        require(balance >= amount, "SANOVA: insufficient residual");

        residualBalances[msg.sender] = balance - amount;
        require(settlementToken.transfer(msg.sender, amount), "SANOVA: residual transfer failed");

        emit ResidualWithdrawn(msg.sender, amount);
    }
}
