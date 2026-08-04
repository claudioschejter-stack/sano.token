// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface ISafeModuleExecutor {
    /// @dev Safe `Enum.Operation`: 0 = Call, 1 = DelegateCall.
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external returns (bool success);
}

interface IErc20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IKycToken {
    function kycApproved(address account) external view returns (bool);
}

/**
 * @title SanovaDeliveryOperatorModule
 * @notice Safe module that delegates **only** the delivery of vault shares to
 *         investors who already passed KYC.
 *
 * Once the governance Safe owns the vaults, handing an investor their shares is
 * a Safe transaction. At threshold 2 that would put a manual signature in the
 * middle of every purchase, so checkout would stop being automatic.
 *
 * This module keeps the Safe multisig for everything critical while letting a
 * delivery operator move shares of allowlisted vaults, and only towards
 * addresses the paired asset token has already whitelisted. It cannot mint,
 * pause, change ownership, whitelist anyone, or send to an unapproved address.
 */
contract SanovaDeliveryOperatorModule {
    /// @notice Safe that custodies the shares and governs this module.
    address public immutable safe;

    /// @notice Wallets allowed to deliver shares (e.g. the Privy operator).
    mapping(address => bool) public isOperator;

    /**
     * @notice Asset token that gates delivery for a given vault.
     * @dev Zero means the vault is not allowlisted. Recipients must be
     *      `kycApproved` on this token, which is what stops an operator from
     *      draining the Safe to an arbitrary address.
     */
    mapping(address => address) public vaultKycToken;

    /// @notice Optional per-transaction ceiling per vault. Zero means no cap.
    mapping(address => uint256) public maxDeliveryPerTx;

    event OperatorUpdated(address indexed operator, bool allowed);
    event VaultAllowedUpdated(address indexed vault, address indexed kycToken, uint256 maxPerTx);
    event SharesDelivered(
        address indexed vault,
        address indexed investor,
        uint256 amount,
        address indexed operator
    );

    error NotSafe();
    error NotOperator();
    error VaultNotAllowed(address vault);
    error RecipientNotApproved(address vault, address investor);
    error AmountAboveCap(address vault, uint256 amount, uint256 cap);
    error ZeroAddress();
    error ZeroAmount();
    error SafeExecutionFailed(address vault, address investor);

    modifier onlySafe() {
        if (msg.sender != safe) revert NotSafe();
        _;
    }

    modifier onlyOperator() {
        if (!isOperator[msg.sender]) revert NotOperator();
        _;
    }

    constructor(address safe_) {
        if (safe_ == address(0)) revert ZeroAddress();
        safe = safe_;
    }

    /// @notice Grant or revoke delivery rights. Safe-only.
    function setOperator(address operator, bool allowed) external onlySafe {
        if (operator == address(0)) revert ZeroAddress();
        isOperator[operator] = allowed;
        emit OperatorUpdated(operator, allowed);
    }

    /**
     * @notice Allowlist a vault for delivery and bind it to its KYC token.
     * @param kycToken Asset token whose `kycApproved` gates recipients. Pass
     *        the zero address to revoke the vault.
     * @param maxPerTx Per-transaction ceiling, or zero for no cap.
     */
    function setVaultAllowed(address vault, address kycToken, uint256 maxPerTx) external onlySafe {
        if (vault == address(0)) revert ZeroAddress();
        vaultKycToken[vault] = kycToken;
        maxDeliveryPerTx[vault] = maxPerTx;
        emit VaultAllowedUpdated(vault, kycToken, maxPerTx);
    }

    /// @notice Whether this module would let `investor` receive `amount` of `vault` today.
    function canDeliver(
        address vault,
        address investor,
        uint256 amount
    ) external view returns (bool) {
        address kycToken = vaultKycToken[vault];
        if (kycToken == address(0) || investor == address(0) || amount == 0) {
            return false;
        }
        uint256 cap = maxDeliveryPerTx[vault];
        if (cap != 0 && amount > cap) {
            return false;
        }
        return IKycToken(kycToken).kycApproved(investor);
    }

    /// @notice Deliver vault shares held by the Safe to a whitelisted investor.
    function deliverShares(address vault, address investor, uint256 amount) external onlyOperator {
        address kycToken = vaultKycToken[vault];
        if (kycToken == address(0)) revert VaultNotAllowed(vault);
        if (investor == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 cap = maxDeliveryPerTx[vault];
        if (cap != 0 && amount > cap) revert AmountAboveCap(vault, amount, cap);

        if (!IKycToken(kycToken).kycApproved(investor)) {
            revert RecipientNotApproved(vault, investor);
        }

        bool ok = ISafeModuleExecutor(safe).execTransactionFromModule(
            vault,
            0,
            abi.encodeCall(IErc20.transfer, (investor, amount)),
            0
        );
        if (!ok) revert SafeExecutionFailed(vault, investor);

        emit SharesDelivered(vault, investor, amount, msg.sender);
    }
}
