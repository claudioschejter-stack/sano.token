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

interface IKycToken {
    function setKyc(address account, bool approved) external;
    function scheduleAdminAction(bytes32 actionId) external;
}

/**
 * @title SanovaKycOperatorModule
 * @notice Safe module that delegates **only** investor whitelisting.
 *
 * Sanova's asset tokens are `Ownable`: whoever owns them can mint, pause and
 * transfer ownership. Handing that key to an automation wallet would trade
 * governance for convenience.
 *
 * This module keeps the Safe as token owner (multisig for critical actions)
 * while letting a compliance operator call `setKyc` on allowlisted tokens only.
 * It cannot mint, pause, move funds or change ownership.
 */
contract SanovaKycOperatorModule {
    /// @notice Safe that owns the asset tokens and governs this module.
    address public immutable safe;

    /// @notice Wallets allowed to whitelist investors (e.g. the Privy operator).
    mapping(address => bool) public isOperator;

    /// @notice Tokens this module may call `setKyc` on.
    mapping(address => bool) public isTokenAllowed;

    event OperatorUpdated(address indexed operator, bool allowed);
    event TokenAllowedUpdated(address indexed token, bool allowed);
    event KycUpdated(address indexed token, address indexed investor, bool approved, address indexed operator);
    event KycScheduled(address indexed token, address indexed investor, bool approved, address indexed operator);

    error NotSafe();
    error NotOperator();
    error TokenNotAllowed(address token);
    error ZeroAddress();
    error SafeExecutionFailed(address token, address investor);

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

    /// @notice Grant or revoke whitelisting rights. Safe-only.
    function setOperator(address operator, bool allowed) external onlySafe {
        if (operator == address(0)) revert ZeroAddress();
        isOperator[operator] = allowed;
        emit OperatorUpdated(operator, allowed);
    }

    /// @notice Scope this module to specific asset tokens. Safe-only.
    function setTokenAllowed(address token, bool allowed) external onlySafe {
        if (token == address(0)) revert ZeroAddress();
        isTokenAllowed[token] = allowed;
        emit TokenAllowedUpdated(token, allowed);
    }

    /**
     * @notice Start the token's timelock for one investor's whitelisting.
     *
     * `setKyc` on the token is timelocked: the action must be scheduled and then
     * wait out the token's admin delay. Without this the operator could only
     * ever perform the second half, so whitelisting reverted and the Safe had to
     * schedule by hand — which stops being automatic the moment the Safe needs
     * two signatures.
     *
     * The action id is computed here rather than accepted as an argument, so an
     * operator can only ever schedule a whitelisting. It cannot schedule a mint,
     * an unpause or a delay change.
     */
    function scheduleKyc(address token, address investor, bool approved) external onlyOperator {
        if (!isTokenAllowed[token]) revert TokenNotAllowed(token);
        if (investor == address(0)) revert ZeroAddress();

        bytes32 actionId = kycActionId(investor, approved);
        bool ok = ISafeModuleExecutor(safe).execTransactionFromModule(
            token,
            0,
            abi.encodeCall(IKycToken.scheduleAdminAction, (actionId)),
            0
        );
        if (!ok) revert SafeExecutionFailed(token, investor);

        emit KycScheduled(token, investor, approved, msg.sender);
    }

    /// @notice The token's action id for whitelisting `investor`, for off-chain checks.
    function kycActionId(address investor, bool approved) public pure returns (bytes32) {
        return keccak256(abi.encode("SET_KYC", investor, approved));
    }

    /// @notice Whitelist (or revoke) one investor on an allowlisted token.
    function setKyc(address token, address investor, bool approved) external onlyOperator {
        _setKyc(token, investor, approved);
    }

    /// @notice Same as {setKyc} for several investors in one transaction.
    function setKycBatch(address token, address[] calldata investors, bool approved) external onlyOperator {
        for (uint256 i = 0; i < investors.length; i++) {
            _setKyc(token, investors[i], approved);
        }
    }

    function _setKyc(address token, address investor, bool approved) private {
        if (!isTokenAllowed[token]) revert TokenNotAllowed(token);
        if (investor == address(0)) revert ZeroAddress();

        bool ok = ISafeModuleExecutor(safe).execTransactionFromModule(
            token,
            0,
            abi.encodeCall(IKycToken.setKyc, (investor, approved)),
            0
        );
        if (!ok) revert SafeExecutionFailed(token, investor);

        emit KycUpdated(token, investor, approved, msg.sender);
    }
}
