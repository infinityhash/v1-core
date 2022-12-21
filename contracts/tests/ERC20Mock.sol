// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract USDPMockTocken is ERC20, Ownable {
    constructor() ERC20("USDP Mock Tocken", "USDP") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    function mintToMe(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}
