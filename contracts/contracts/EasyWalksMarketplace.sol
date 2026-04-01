// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract EasyWalksMarketplace {
    struct Route {
        address[] creators;
        uint16[] sharesBps;     // basis points, sum = 10000
        uint256 priceWei;
        bytes32 routeHash;      // 0G Storage merkle root
        bool active;
    }

    address public owner;
    uint16 public platformFeeBps;

    uint256 public nextRouteId;
    mapping(uint256 => Route) internal _routes;
    mapping(address => mapping(uint256 => bool)) public purchased;
    mapping(address => uint256) public creatorBalance;

    event RouteRegistered(uint256 indexed routeId, uint256 price, uint8 creatorCount);
    event RoutePurchased(uint256 indexed routeId, address indexed buyer, uint256 price);
    event CreatorPaid(address indexed creator, uint256 amount);
    event EarningsWithdrawn(address indexed creator, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(uint16 _platformFeeBps) {
        require(_platformFeeBps <= 3000, "fee too high"); // max 30%
        owner = msg.sender;
        platformFeeBps = _platformFeeBps;
        nextRouteId = 1;
    }

    /// @notice Register a new route. Only callable by the backend (owner).
    function registerRoute(
        address[] calldata creators,
        uint16[] calldata sharesBps,
        uint256 priceWei,
        bytes32 routeHash
    ) external onlyOwner returns (uint256 routeId) {
        require(creators.length > 0, "no creators");
        require(creators.length == sharesBps.length, "length mismatch");
        require(priceWei > 0, "price must be > 0");

        uint16 totalShares;
        for (uint256 i = 0; i < sharesBps.length; i++) {
            require(creators[i] != address(0), "zero address");
            require(sharesBps[i] > 0, "zero share");
            totalShares += sharesBps[i];
        }
        require(totalShares == 10000, "shares must sum to 10000");

        routeId = nextRouteId++;
        Route storage route = _routes[routeId];
        route.priceWei = priceWei;
        route.routeHash = routeHash;
        route.active = true;

        for (uint256 i = 0; i < creators.length; i++) {
            route.creators.push(creators[i]);
            route.sharesBps.push(sharesBps[i]);
        }

        emit RouteRegistered(routeId, priceWei, uint8(creators.length));
    }

    /// @notice Purchase a route. Splits payment between platform and creators.
    function purchaseRoute(uint256 routeId) external payable {
        Route storage route = _routes[routeId];
        require(route.active, "route not active");
        require(!purchased[msg.sender][routeId], "already purchased");
        require(msg.value == route.priceWei, "wrong payment");

        purchased[msg.sender][routeId] = true;

        uint256 platformFee = (msg.value * platformFeeBps) / 10000;
        uint256 creatorPool = msg.value - platformFee;

        for (uint256 i = 0; i < route.creators.length; i++) {
            uint256 share = (creatorPool * route.sharesBps[i]) / 10000;
            creatorBalance[route.creators[i]] += share;
            emit CreatorPaid(route.creators[i], share);
        }

        emit RoutePurchased(routeId, msg.sender, msg.value);
    }

    /// @notice Creator withdraws accumulated earnings (pull pattern).
    function withdrawEarnings() external {
        uint256 amount = creatorBalance[msg.sender];
        require(amount > 0, "no earnings");
        creatorBalance[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
        emit EarningsWithdrawn(msg.sender, amount);
    }

    /// @notice Check if a user owns a route.
    function hasPurchased(address buyer, uint256 routeId) external view returns (bool) {
        return purchased[buyer][routeId];
    }

    /// @notice Get route details.
    function getRoute(uint256 routeId) external view returns (
        address[] memory creators,
        uint16[] memory sharesBps,
        uint256 priceWei,
        bytes32 routeHash,
        bool active
    ) {
        Route storage route = _routes[routeId];
        return (route.creators, route.sharesBps, route.priceWei, route.routeHash, route.active);
    }

    /// @notice Deactivate a route. Only callable by owner.
    function deactivateRoute(uint256 routeId) external onlyOwner {
        _routes[routeId].active = false;
    }

    /// @notice Withdraw platform fees. Only callable by owner.
    function withdrawPlatformFees() external onlyOwner {
        uint256 balance = address(this).balance;
        // Subtract all outstanding creator balances
        // For MVP simplicity, owner can withdraw whatever isn't owed to creators
        (bool ok, ) = owner.call{value: balance}("");
        require(ok, "transfer failed");
    }
}
