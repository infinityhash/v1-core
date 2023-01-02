// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

import "./InfinityHash.sol";

import "hardhat/console.sol";

/// @title InfinityHash NFT
/// @author Prëxis Labs
/// @custom:security-contact security@prexis.io
contract InfinityHashNFT is
    ERC1155,
    ERC1155Holder,
    Ownable,
    ERC1155Burnable,
    ERC1155Supply
{
    address public immutable stablecoin;
    address public token;

    struct Batch {
        uint256 price;
        uint256 timelock;
    }

    mapping(uint256 => Batch) public batches;

    error ZeroAddress();
    error TokenAlreadySet(address token);

    error ZeroPrice();
    error ZeroSupply();
    error BatchExists();
    error BatchNotExists();
    error BatchSold();

    error ZeroAmount();
    error TooSoon();

    event Mint(
        uint256 indexed batchId,
        uint256 price,
        uint256 totalSupply,
        uint256 timelock
    );

    event Purchase(
        address indexed purchaser,
        uint256 indexed batchId,
        uint256 quantity,
        uint256 unitPrice,
        uint256 total
    );

    constructor(address _owner, address _stablecoin) ERC1155("") {
        _transferOwnership(_owner);
        stablecoin = _stablecoin;
    }

    // Externals

    /**
     * @notice Set the ERC-20 token contract address
     * @dev Only set once
     * @param _token The token contract address
     */
    function setTokenContract(address _token) external onlyOwner {
        if (_token == address(0)) revert ZeroAddress();
        if (token != address(0)) revert TokenAlreadySet(token);
        token = _token;
    }

    function setURI(string memory newuri) external onlyOwner {
        _setURI(newuri);
    }

    /**
     * @notice Mint a new batch of NFTs
     * @dev Only new batches allowed, it's not possible to mint more units of an existing batch
     * @param _id The batch ID
     * @param _totalSupply The total supply of the batch
     * @param _timelock The timelock release
     * @param _price The price of the unit in stablecoin, considering decimals
     */
    function mint(
        uint256 _id,
        uint256 _totalSupply,
        uint256 _timelock,
        uint256 _price
    ) external onlyOwner {
        if (_price == 0) revert ZeroPrice();
        if (_totalSupply == 0) revert ZeroSupply();
        if (exists(_id)) revert BatchExists();

        _mint(address(this), _id, _totalSupply, "");

        batches[_id].price = _price;
        batches[_id].timelock = _timelock;

        emit Mint(_id, _price, _totalSupply, _timelock);
    }

    /**
     * @notice Remove a unsold batch of NFTs
     * @dev Only removes lots that no NFT has been sold
     * @param _id The batch ID
     */
    function removeBatch(uint256 _id) external onlyOwner {
        if (!exists(_id)) revert BatchNotExists();
        if (sold(_id)) revert BatchSold();

        uint256 totalSupply = totalSupply(_id);

        _burn(address(this), _id, totalSupply);

        delete batches[_id];
    }

    /**
     * @notice Purchase NFTs from a batch
     * @param _id The batch ID
     * @param _qty The amount of NFTs to purchase
     */
    function purchase(uint256 _id, uint256 _qty) external {
        if (!exists(_id)) revert BatchNotExists();
        if (_qty == 0) revert ZeroAmount();

        uint256 price = batches[_id].price;
        uint256 total = price * _qty;

        IERC20(stablecoin).transferFrom(msg.sender, address(this), total);

        _safeTransferFrom(address(this), msg.sender, _id, _qty, "");

        emit Purchase(msg.sender, _id, _qty, price, total);
    }

    function redeem(uint256 _id, uint256 _qty) external {
        if (!exists(_id)) revert BatchNotExists();
        if (_qty == 0) revert ZeroAmount();
        if (batches[_id].timelock > block.timestamp) revert TooSoon();

        _burn(msg.sender, _id, _qty);

        // burn NFTs
        // mint ERC20
    }

    /**
     * @notice Checks if any NFT from batch has been sold
     * @param _id The batch ID
     * @return True if any NFT from batch has been sold
     */
    function sold(uint256 _id) public view returns (bool) {
        return totalSupply(_id) != balanceOf(address(this), _id);
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

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC1155, ERC1155Receiver) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
