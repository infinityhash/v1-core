// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./InfinityHash.sol";

import "hardhat/console.sol";

/// @title InfinityHash NFT
/// @author Prëxis Labs
/// @custom:security-contact security@prexis.io
contract InfinityHashNFT is ERC1155, ERC1155Holder, Ownable, ERC1155Supply {
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    /// @notice Next batch ID
    Counters.Counter public batchIdCounter;

    /// @notice Stablecoin token address constant
    address public immutable stablecoin;

    /// @notice Infinity Hash token address
    /// @dev Set once on deployment
    address public token;

    /// @notice Batch total supply
    uint256 public constant batchTotalSupply = 10000;

    /// @notice Batch redeem time lock (3 months)
    uint256 public constant batchTimelock = 60 * 60 * 24 * 30 * 3;

    /// @notice Redeemable amount of Infinity Hash tokens
    uint256 public constant tokensToBeMinted = 1000;

    struct Batch {
        uint256 price;
        uint256 timelock;
        uint256 initialSupply;
        uint256 sold;
        uint256 redeemed;
    }

    /// @notice Batches minted
    /// @return price The price of each NFT from the batch
    /// @return timelock The time lock for redeeming Infinity Hash tokens (3 months)
    /// @return initialSupply The initial supply of the batch
    /// @return sold The amount of NFTs sold from the batch
    /// @return redeemed The amount of Infinity Hash tokens redeemed
    mapping(uint256 => Batch) public batches;

    error ZeroAddress();
    error InvalidAddress();
    error TokenAlreadySet(address token);

    error ZeroPrice();
    error ZeroSupply();
    error TokenNotConfigured();

    error BatchNotExists();
    error NoBatches();
    error BatchSold();

    error ZeroAmount();
    error TooSoon();

    event Mint(
        address indexed owner,
        uint256 indexed batchId,
        uint256 price,
        uint256 totalSupply,
        uint256 timelock
    );

    event Remove(
        address indexed owner,
        uint256 indexed batchId,
        uint256 totalSupply
    );

    event Purchase(
        address indexed purchaser,
        uint256 indexed batchId,
        uint256 quantity,
        uint256 unitPrice,
        uint256 total
    );

    event Redeem(
        address indexed purchaser,
        uint256 indexed batchId,
        uint256 quantity,
        uint256 total
    );

    event TransferERC20(
        address indexed owner,
        address indexed token,
        address indexed to,
        uint256 amount
    );

    /**
     * @notice Constructor
     * @dev Ownership is transferred on deployment time
     * @dev Stablecoin is set on deployment time only
     * @param _owner The owner of the contract
     * @param _stablecoin The stablecoin address
     */
    constructor(address _owner, address _stablecoin) ERC1155("") {
        _transferOwnership(_owner);
        stablecoin = _stablecoin;
    }

    /**
     * @notice Set the ERC-20 token contract address
     * @dev Only set once
     * @param _token The token contract address
     */
    function setTokenContract(address _token) external onlyOwner {
        if (_token == address(0)) revert ZeroAddress();
        if (_token == address(this)) revert InvalidAddress();
        if (token != address(0)) revert TokenAlreadySet(token);
        token = _token;
    }

    /**
     * @notice Set the URI for the NFTs
     * @param newuri The new URI
     */
    function setURI(string memory newuri) external onlyOwner {
        _setURI(newuri);
    }

    /**
     * @notice Mint a new batch of NFTs
     * @dev Only new batches allowed, it's not possible to mint more units of an existing batch
     * @dev Only owner can mint batches
     * @param _price The price of the unit in stablecoin, considering decimals
     * @return batchId The batch ID
     */
    function mint(uint256 _price) external onlyOwner returns (uint256 batchId) {
        if (_price == 0) revert ZeroPrice();
        if (token == address(0)) revert TokenNotConfigured();

        batchId = batchIdCounter.current();
        batchIdCounter.increment();

        _mint(address(this), batchId, batchTotalSupply, "");

        batches[batchId].price = _price;
        batches[batchId].timelock = block.timestamp + batchTimelock;
        batches[batchId].initialSupply = batchTotalSupply;

        emit Mint(
            msg.sender,
            batchId,
            _price,
            batchTotalSupply,
            batches[batchId].timelock
        );
    }

    /**
     * @notice Remove the last batch
     * @dev Only owner can remove batches
     * @dev Only removes batch if no NFT has been sold
     */
    function removeLastBatch() external onlyOwner {
        if (batchIdCounter.current() == 0) revert NoBatches();

        uint256 lastBatchId = batchIdCounter.current() - 1;

        if (sold(lastBatchId)) revert BatchSold();

        uint256 totalSupply = totalSupply(lastBatchId);

        _burn(address(this), lastBatchId, totalSupply);

        delete batches[lastBatchId];
        batchIdCounter.decrement();

        emit Remove(msg.sender, lastBatchId, totalSupply);
    }

    /**
     * @notice Transfer ERC-20 tokens from contract to an address
     * @dev Only owner can transfer tokens
     * @param _token The token contract address
     * @param _to The recipient address
     * @param _amount The amount to transfer
     */
    function erc20Transfer(
        address _token,
        address _to,
        uint256 _amount
    ) external onlyOwner {
        IERC20(_token).safeTransfer(_to, _amount);

        emit TransferERC20(msg.sender, _token, _to, _amount);
    }

    /**
     * @notice Purchase NFTs from a batch transferring stablecoins
     * @param _id The batch ID
     * @param _qty The amount of NFTs to purchase
     */
    function purchase(uint256 _id, uint256 _qty) external {
        if (!exists(_id)) revert BatchNotExists();
        if (_qty == 0) revert ZeroAmount();

        uint256 price = batches[_id].price;
        uint256 total = price * _qty;

        IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), total);

        _safeTransferFrom(address(this), msg.sender, _id, _qty, "");

        batches[_id].sold += _qty;

        emit Purchase(msg.sender, _id, _qty, price, total);
    }

    /**
     * @notice Redeem NFTs from a batch burning them and getting the Infinity Hash ERC-20 tokens
     * @param _id The batch ID
     * @param _qty The amount of NFTs to redeem
     */
    function redeem(uint256 _id, uint256 _qty) external {
        if (!exists(_id)) revert BatchNotExists();
        if (_qty == 0) revert ZeroAmount();
        if (batches[_id].timelock > block.timestamp) revert TooSoon();

        _burn(msg.sender, _id, _qty);

        uint256 decimals = InfinityHash(token).decimals();

        uint256 total = (_qty * tokensToBeMinted) * 10 ** decimals;

        InfinityHash(token).mint(msg.sender, total);

        batches[_id].redeemed += _qty;

        emit Redeem(msg.sender, _id, _qty, total);
    }

    /**
     * @notice Returns batch metadata URI
     * @param _id The batch ID
     * @return uri The batch metadata URI
     */
    function uri(uint256 _id) public view override returns (string memory) {
        return
            string(
                abi.encodePacked(super.uri(_id), Strings.toString(_id), ".json")
            );
    }

    /**
     * @notice Checks if any NFT from batch has been sold
     * @param _id The batch ID
     * @return True if any NFT from batch has been sold
     */
    function sold(uint256 _id) public view returns (bool) {
        return batches[_id].initialSupply != balanceOf(address(this), _id);
    }

    // Overrides

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
