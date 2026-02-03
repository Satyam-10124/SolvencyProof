// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockVerifier {
    bool public alwaysValid;

    constructor(bool _alwaysValid) {
        alwaysValid = _alwaysValid;
    }

    function setAlwaysValid(bool _valid) external {
        alwaysValid = _valid;
    }

    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[3] calldata
    ) external view returns (bool) {
        return alwaysValid;
    }
}
