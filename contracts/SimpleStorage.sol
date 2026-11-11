// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleStorage {
    uint256 public value;

    event ValueChanged(uint256 newValue);

    function setValue(uint256 newValue) external {
        value = newValue;
        emit ValueChanged(newValue);
    }
}
