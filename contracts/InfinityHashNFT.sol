// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";

/// @custom:security-contact security@prexis.io
contract InfinityHashNFT is ERC1155, Ownable, ERC1155Burnable, ERC1155Supply {
    address public immutable stablecoin;
    address public immutable redeemToken;

    struct Token {
        uint256 price;
        uint256 totalSupply;
        uint256 timelock;
        uint256 sold;
    }

    mapping(uint256 => Token) private tokens;

    error ZeroPrice();
    error ZeroSupply();
    error BatchExists();

    error TokenNotExists();
    error ZeroAmount();
    error TooSoon();
    error PurchaseTransferFailed();

    event Batch(
        uint256 indexed id,
        uint256 price,
        uint256 totalSupply,
        uint256 timelock
    );

    event Buy(
        address indexed buyer,
        uint256 indexed id,
        uint256 amount,
        uint256 value
    );

    constructor(
        address _owner,
        address _stablecoin,
        address _redeemToken
    ) ERC1155("") {
        _transferOwnership(_owner);
        stablecoin = _stablecoin;
        redeemToken = _redeemToken;
    }

    // Externals

    function setURI(string memory newuri) external onlyOwner {
        _setURI(newuri);
    }

    function mint(
        uint256 _id,
        uint256 _totalSupply,
        uint256 _timelock,
        uint256 _price
    ) external onlyOwner {
        if (_price == 0) revert ZeroPrice();
        if (_totalSupply == 0) revert ZeroSupply();
        if (batchExists(_id)) revert BatchExists();

        _mint(address(this), _id, _totalSupply, "");

        tokens[_id].price = _price;
        tokens[_id].totalSupply = _totalSupply;
        tokens[_id].timelock = _timelock;

        emit Batch(_id, _price, _totalSupply, _timelock);
    }

    function buy(uint256 _id, uint256 _amount) external {
        uint256 price = tokens[_id].price;
        if (price == 0) revert TokenNotExists();

        if (_amount == 0) revert ZeroAmount();

        if (tokens[_id].timelock > block.timestamp) revert TooSoon();

        uint256 value = price * _amount;

        if (!IERC20(stablecoin).transferFrom(msg.sender, address(this), value))
            revert PurchaseTransferFailed();

        safeTransferFrom(address(this), msg.sender, _id, _amount, "");

        emit Buy(msg.sender, _id, _amount, value);
    }

    // Views

    function batchExists(uint256 _id) public view returns (bool) {
        return tokens[_id].price != 0;
    }

    function getBatch(
        uint256 _id
    ) external view returns (uint256 price, uint256 totalSupply, uint256 timelock) {
        price = tokens[_id].price;
        totalSupply = tokens[_id].totalSupply;
        timelock = tokens[_id].timelock;
    }

    // Internals

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override(ERC1155, ERC1155Supply) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}
