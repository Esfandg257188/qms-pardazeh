// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract UserCreatedToken is ERC20 {
    address public immutable creator;

    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        uint256 initialSupply,
        address recipient
    ) ERC20(tokenName, tokenSymbol) {
        require(bytes(tokenName).length > 0, "Empty token name");
        require(bytes(tokenSymbol).length > 0, "Empty token symbol");
        require(recipient != address(0), "Invalid recipient");
        require(initialSupply > 0, "Supply must be positive");

        creator = recipient;
        _mint(recipient, initialSupply);
    }
}
