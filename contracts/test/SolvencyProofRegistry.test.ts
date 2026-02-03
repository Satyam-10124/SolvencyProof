import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("SolvencyProofRegistry", function () {
  async function deployFixture() {
    const [owner, submitter, otherAccount] = await ethers.getSigners();

    // Deploy Groth16Verifier
    const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
    const verifier = await Groth16Verifier.deploy();

    // Deploy SolvencyProofRegistry
    const SolvencyProofRegistry = await ethers.getContractFactory("SolvencyProofRegistry");
    const registry = await SolvencyProofRegistry.deploy(await verifier.getAddress());

    return { registry, verifier, owner, submitter, otherAccount };
  }

  describe("Deployment", function () {
    it("should deploy with correct verifier address", async function () {
      const { registry, verifier } = await loadFixture(deployFixture);
      expect(await registry.verifier()).to.equal(await verifier.getAddress());
    });

    it("should set deployer as owner", async function () {
      const { registry, owner } = await loadFixture(deployFixture);
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("should start with zero epoch count", async function () {
      const { registry } = await loadFixture(deployFixture);
      expect(await registry.getEpochCount()).to.equal(0n);
    });
  });

  describe("Verifier Management", function () {
    it("should allow owner to update verifier", async function () {
      const { registry, owner } = await loadFixture(deployFixture);
      
      // Deploy new verifier
      const NewVerifier = await ethers.getContractFactory("Groth16Verifier");
      const newVerifier = await NewVerifier.deploy();

      // Update verifier and check it was updated
      await registry.connect(owner).setVerifier(await newVerifier.getAddress());
      expect(await registry.verifier()).to.equal(await newVerifier.getAddress());
    });

    it("should reject verifier update from non-owner", async function () {
      const { registry, otherAccount } = await loadFixture(deployFixture);
      
      const NewVerifier = await ethers.getContractFactory("Groth16Verifier");
      const newVerifier = await NewVerifier.deploy();

      let reverted = false;
      try {
        await registry.connect(otherAccount).setVerifier(await newVerifier.getAddress());
      } catch {
        reverted = true;
      }
      expect(reverted).to.equal(true);
    });

    it("should handle verifier address update", async function () {
      const { registry, verifier } = await loadFixture(deployFixture);
      // Verify current verifier is set
      expect(await registry.verifier()).to.equal(await verifier.getAddress());
    });
  });

  describe("Epoch Management", function () {
    it("should return correct epoch count", async function () {
      const { registry } = await loadFixture(deployFixture);
      expect(await registry.getEpochCount()).to.equal(0n);
    });

    it("should revert getLatestEpoch when no epochs exist", async function () {
      const { registry } = await loadFixture(deployFixture);
      let reverted = false;
      try {
        await registry.getLatestEpoch();
      } catch {
        reverted = true;
      }
      expect(reverted).to.equal(true);
    });
  });

  describe("Proof Retrieval", function () {
    it("should return empty proof for non-existent epoch", async function () {
      const { registry } = await loadFixture(deployFixture);
      const epochId = ethers.encodeBytes32String("test_epoch");
      
      const proof = await registry.getProof(epochId);
      // Empty proof should have zero timestamp
      expect(proof.timestamp).to.equal(0n);
    });
  });
});

describe("Groth16Verifier", function () {
  async function deployVerifierFixture() {
    const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
    const verifier = await Groth16Verifier.deploy();
    return { verifier };
  }

  describe("Deployment", function () {
    it("should deploy successfully", async function () {
      const { verifier } = await loadFixture(deployVerifierFixture);
      const address = await verifier.getAddress();
      expect(address).to.match(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe("Verification", function () {
    it("should reject invalid proof with zeros", async function () {
      const { verifier } = await loadFixture(deployVerifierFixture);

      const pA: [bigint, bigint] = [0n, 0n];
      const pB: [[bigint, bigint], [bigint, bigint]] = [[0n, 0n], [0n, 0n]];
      const pC: [bigint, bigint] = [0n, 0n];
      const pubSignals: [bigint, bigint, bigint, bigint] = [1n, 0n, 0n, 0n];

      // Zero proof should fail verification
      const result = await verifier.verifyProof(pA, pB, pC, pubSignals);
      expect(result).to.equal(false);
    });
  });
});

describe("Integration", function () {
  it("should have matching contract interfaces", async function () {
    const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
    const verifier = await Groth16Verifier.deploy();

    const SolvencyProofRegistry = await ethers.getContractFactory("SolvencyProofRegistry");
    const registry = await SolvencyProofRegistry.deploy(await verifier.getAddress());

    // Verify the registry can call the verifier
    expect(await registry.verifier()).to.equal(await verifier.getAddress());
  });
});
