// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GMBoard {
    address public immutable owner;
    bool public limitsEnabled;
    uint256 public cooldown = 86400;

    mapping(address => uint256) public lastGM;

    event GMRecorded(address indexed user, uint256 timestamp);
    event LimitConfigUpdated(bool enabled, uint256 cooldown);

    constructor() {
        owner = msg.sender;
        limitsEnabled = false;
    }

    function sendGM() external {
        if (limitsEnabled) {
            require(
                lastGM[msg.sender] == 0 ||
                block.timestamp >= lastGM[msg.sender] + cooldown,
                "GM cooldown active"
            );
        }

        lastGM[msg.sender] = block.timestamp;
        emit GMRecorded(msg.sender, block.timestamp);
    }

    function setLimitConfig(bool enabled, uint256 newCooldown) external {
        require(msg.sender == owner, "Not owner");
        require(newCooldown > 0, "Invalid cooldown");

        limitsEnabled = enabled;
        cooldown = newCooldown;

        emit LimitConfigUpdated(enabled, newCooldown);
    }
}
