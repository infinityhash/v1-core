// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract InfinityHashToken is ERC20, Ownable {
    address public nftContract;

    error NftContractAlreadySet();
    error notNftContract(address nftContract, address caller);

    constructor(address _owner) ERC20("InfinityHash Token", "INFH") {
        _transferOwnership(_owner);
    }

    function setNftContract(address _nftContract) external onlyOwner {
        if (nftContract != address(0)) revert NftContractAlreadySet();
        nftContract = _nftContract;
    }

    function mint(address to, uint256 amount) public {
        if (msg.sender != nftContract)
            revert notNftContract(nftContract, msg.sender);
        _mint(to, amount);
    }
}
