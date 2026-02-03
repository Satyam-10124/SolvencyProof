// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGroth16Verifier {
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[3] calldata _pubSignals
    ) external view returns (bool);
}

contract SolvencyProofRegistry {
    struct SolvencyProof {
        bytes32 epochId;
        bytes32 liabilitiesRoot;
        uint256 reservesTotal;
        uint256 timestamp;
        address submitter;
        bool verified;
    }

    IGroth16Verifier public verifier;
    address public owner;

    mapping(bytes32 => SolvencyProof) public proofs;
    bytes32[] public epochIds;

    event SolvencyProved(
        bytes32 indexed epochId,
        bytes32 liabilitiesRoot,
        uint256 reservesTotal,
        uint256 timestamp,
        address indexed submitter
    );

    event VerifierUpdated(address indexed oldVerifier, address indexed newVerifier);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _verifier) {
        owner = msg.sender;
        verifier = IGroth16Verifier(_verifier);
    }

    function setVerifier(address _verifier) external onlyOwner {
        address old = address(verifier);
        verifier = IGroth16Verifier(_verifier);
        emit VerifierUpdated(old, _verifier);
    }

    function submitProof(
        bytes32 epochId,
        bytes32 liabilitiesRoot,
        uint256 reservesTotal,
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC
    ) external {
        require(proofs[epochId].timestamp == 0, "Epoch already submitted");

        // Public signals: [liabilitiesRoot, reservesTotal, epochId]
        uint256[3] memory pubSignals = [
            uint256(liabilitiesRoot),
            reservesTotal,
            uint256(epochId)
        ];

        bool valid = verifier.verifyProof(_pA, _pB, _pC, pubSignals);
        require(valid, "Invalid proof");

        proofs[epochId] = SolvencyProof({
            epochId: epochId,
            liabilitiesRoot: liabilitiesRoot,
            reservesTotal: reservesTotal,
            timestamp: block.timestamp,
            submitter: msg.sender,
            verified: true
        });

        epochIds.push(epochId);

        emit SolvencyProved(
            epochId,
            liabilitiesRoot,
            reservesTotal,
            block.timestamp,
            msg.sender
        );
    }

    function getProof(bytes32 epochId) external view returns (SolvencyProof memory) {
        return proofs[epochId];
    }

    function getEpochCount() external view returns (uint256) {
        return epochIds.length;
    }

    function getLatestEpoch() external view returns (bytes32) {
        require(epochIds.length > 0, "No epochs");
        return epochIds[epochIds.length - 1];
    }

    function isEpochVerified(bytes32 epochId) external view returns (bool) {
        return proofs[epochId].verified;
    }
}
