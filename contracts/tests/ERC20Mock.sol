// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract USDPMockTocken is ERC20, Ownable {
    uint8 customDecimals;

    constructor(uint8 _decimals) ERC20("USDP Mock Tocken", "USDP") {
        customDecimals = _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function mintToMe(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function decimals() public view override returns (uint8) {
        return customDecimals;
    }
}
