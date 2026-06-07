// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SanovaRwaVault} from "./SanovaRwaVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice ERC-7540 async vault over SanovaAssetToken — Centrifuge-ready request/claim flow with KYC gates.
/// @dev Synchronous deposit/redeem can be toggled for bootstrap; async flow is always available.
contract SanovaAsyncVault is SanovaRwaVault {
    struct DepositRequest {
        address controller;
        address owner;
        uint256 assets;
        bool fulfilled;
        bool claimed;
    }

    struct RedeemRequest {
        address controller;
        address owner;
        uint256 shares;
        bool fulfilled;
        bool claimed;
    }

    bool public synchronousDepositEnabled = true;
    bool public synchronousRedeemEnabled = true;

    uint256 public nextDepositRequestId = 1;
    uint256 public nextRedeemRequestId = 1;

    mapping(uint256 => DepositRequest) public depositRequests;
    mapping(uint256 => RedeemRequest) public redeemRequests;
    mapping(address controller => mapping(address operator => bool)) public isOperator;

    event DepositRequestCreated(
        uint256 indexed requestId,
        address indexed controller,
        address indexed owner,
        uint256 assets
    );
    event DepositRequestFulfilled(uint256 indexed requestId, address indexed controller, uint256 assets);
    event DepositClaimed(uint256 indexed requestId, address indexed controller, uint256 shares);
    event RedeemRequestCreated(
        uint256 indexed requestId,
        address indexed controller,
        address indexed owner,
        uint256 shares
    );
    event RedeemRequestFulfilled(uint256 indexed requestId, address indexed controller, uint256 shares);
    event RedeemClaimed(uint256 indexed requestId, address indexed controller, uint256 assets);
    event OperatorSet(address indexed controller, address indexed operator, bool approved);
    event SynchronousDepositEnabled(bool enabled);
    event SynchronousRedeemEnabled(bool enabled);

    constructor(
        IERC20 asset_,
        string memory name_,
        string memory symbol_,
        address initialOwner
    ) SanovaRwaVault(asset_, name_, symbol_, initialOwner) {}

    function setOperator(address operator, bool approved) external {
        isOperator[msg.sender][operator] = approved;
        emit OperatorSet(msg.sender, operator, approved);
    }

    function setSynchronousDepositEnabled(bool enabled) external onlyOwner {
        synchronousDepositEnabled = enabled;
        emit SynchronousDepositEnabled(enabled);
    }

    function setSynchronousRedeemEnabled(bool enabled) external onlyOwner {
        synchronousRedeemEnabled = enabled;
        emit SynchronousRedeemEnabled(enabled);
    }

    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        require(synchronousDepositEnabled, "SANOVA7540: sync deposit disabled");
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override returns (uint256) {
        require(synchronousDepositEnabled, "SANOVA7540: sync mint disabled");
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner) public override returns (uint256) {
        require(synchronousRedeemEnabled, "SANOVA7540: sync withdraw disabled");
        return super.withdraw(assets, receiver, owner);
    }

    function redeem(uint256 shares, address receiver, address owner) public override returns (uint256) {
        require(synchronousRedeemEnabled, "SANOVA7540: sync redeem disabled");
        return super.redeem(shares, receiver, owner);
    }

    function requestDeposit(uint256 assets, address controller, address owner)
        external
        returns (uint256 requestId)
    {
        require(assets > 0, "SANOVA7540: zero assets");
        _authorizeController(owner, msg.sender);
        IERC20(asset()).transferFrom(owner, address(this), assets);

        requestId = nextDepositRequestId++;
        depositRequests[requestId] = DepositRequest({
            controller: controller,
            owner: owner,
            assets: assets,
            fulfilled: false,
            claimed: false
        });

        emit DepositRequestCreated(requestId, controller, owner, assets);
    }

    function fulfillDepositRequest(uint256 requestId) external onlyOwner {
        DepositRequest storage req = depositRequests[requestId];
        require(req.assets > 0, "SANOVA7540: unknown request");
        require(!req.fulfilled, "SANOVA7540: already fulfilled");

        req.fulfilled = true;
        emit DepositRequestFulfilled(requestId, req.controller, req.assets);
    }

    function claimDeposit(uint256 requestId) external returns (uint256 shares) {
        DepositRequest storage req = depositRequests[requestId];
        require(req.assets > 0, "SANOVA7540: unknown request");
        require(req.fulfilled, "SANOVA7540: not fulfilled");
        require(!req.claimed, "SANOVA7540: already claimed");
        require(
            msg.sender == req.controller || isOperator[req.controller][msg.sender],
            "SANOVA7540: not controller"
        );

        req.claimed = true;
        shares = convertToShares(req.assets);
        _deposit(address(this), req.controller, req.assets, shares);
        emit DepositClaimed(requestId, req.controller, shares);
    }

    function pendingDepositRequest(uint256 requestId, address controller) external view returns (uint256) {
        DepositRequest storage req = depositRequests[requestId];
        if (req.controller != controller || req.fulfilled || req.claimed) {
            return 0;
        }
        return req.assets;
    }

    function claimableDepositRequest(uint256 requestId, address controller) external view returns (uint256) {
        DepositRequest storage req = depositRequests[requestId];
        if (req.controller != controller || !req.fulfilled || req.claimed) {
            return 0;
        }
        return req.assets;
    }

    function requestRedeem(uint256 shares, address controller, address owner)
        external
        returns (uint256 requestId)
    {
        require(shares > 0, "SANOVA7540: zero shares");
        _authorizeController(owner, msg.sender);

        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }
        _transfer(owner, address(this), shares);

        requestId = nextRedeemRequestId++;
        redeemRequests[requestId] = RedeemRequest({
            controller: controller,
            owner: owner,
            shares: shares,
            fulfilled: false,
            claimed: false
        });

        emit RedeemRequestCreated(requestId, controller, owner, shares);
    }

    function fulfillRedeemRequest(uint256 requestId) external onlyOwner {
        RedeemRequest storage req = redeemRequests[requestId];
        require(req.shares > 0, "SANOVA7540: unknown request");
        require(!req.fulfilled, "SANOVA7540: already fulfilled");

        req.fulfilled = true;
        emit RedeemRequestFulfilled(requestId, req.controller, req.shares);
    }

    function claimRedeem(uint256 requestId) external returns (uint256 assets) {
        RedeemRequest storage req = redeemRequests[requestId];
        require(req.shares > 0, "SANOVA7540: unknown request");
        require(req.fulfilled, "SANOVA7540: not fulfilled");
        require(!req.claimed, "SANOVA7540: already claimed");
        require(
            msg.sender == req.controller || isOperator[req.controller][msg.sender],
            "SANOVA7540: not controller"
        );

        req.claimed = true;
        assets = convertToAssets(req.shares);
        _withdraw(address(this), req.controller, address(this), assets, req.shares);
        emit RedeemClaimed(requestId, req.controller, assets);
    }

    function pendingRedeemRequest(uint256 requestId, address controller) external view returns (uint256) {
        RedeemRequest storage req = redeemRequests[requestId];
        if (req.controller != controller || req.fulfilled || req.claimed) {
            return 0;
        }
        return req.shares;
    }

    function claimableRedeemRequest(uint256 requestId, address controller) external view returns (uint256) {
        RedeemRequest storage req = redeemRequests[requestId];
        if (req.controller != controller || !req.fulfilled || req.claimed) {
            return 0;
        }
        return req.shares;
    }

    function _authorizeController(address owner, address caller) internal view {
        require(
            caller == owner || isOperator[owner][caller],
            "SANOVA7540: not owner or operator"
        );
    }
}
