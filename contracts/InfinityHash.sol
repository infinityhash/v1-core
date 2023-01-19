// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract InfinityHash is ERC20{
    address public immutable MINTER;
    error NotMinter(address minter, address caller);

    constructor(address _minter) ERC20("Infinity Hash", "IFH") {
        MINTER = _minter;
    }

    function mint(address to, uint256 amount) public {
        if (msg.sender != MINTER) revert NotMinter(MINTER, msg.sender);
        _mint(to, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return 0;
    }
}
