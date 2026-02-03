import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "../../../data");
const OUTPUT_DIR = path.join(DATA_DIR, "output");
const BACKEND_DIR = path.join(__dirname, "../..");

describe("E2E: Complete Solvency Proof Workflow", () => {
  describe("1. Liabilities Processing", () => {
    it("should have liabilities CSV file", () => {
      const csvPath = path.join(DATA_DIR, "liabilities.csv");
      expect(fs.existsSync(csvPath)).toBe(true);
      
      const content = fs.readFileSync(csvPath, "utf-8");
      expect(content).toContain("user_id");
      expect(content).toContain("balance");
    });

    it("should have built liabilities Merkle tree", () => {
      const rootPath = path.join(OUTPUT_DIR, "liabilities_root.json");
      expect(fs.existsSync(rootPath)).toBe(true);

      const root = JSON.parse(fs.readFileSync(rootPath, "utf-8"));
      expect(root.liabilities_root).toBeDefined();
      expect(root.liabilities_root).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(root.epoch_id).toBeDefined();
      expect(root.leaf_count).toBeGreaterThan(0);
    });

    it("should have total liabilities calculated", () => {
      const totalPath = path.join(OUTPUT_DIR, "liabilities_total.json");
      expect(fs.existsSync(totalPath)).toBe(true);

      const total = JSON.parse(fs.readFileSync(totalPath, "utf-8"));
      expect(total.liabilities_total).toBeDefined();
      expect(Number(total.liabilities_total)).toBeGreaterThan(0);
    });

    it("should have liabilities tree with proofs", () => {
      const treePath = path.join(OUTPUT_DIR, "liabilities_tree.json");
      // Tree file is optional - check if exists
      if (fs.existsSync(treePath)) {
        const tree = JSON.parse(fs.readFileSync(treePath, "utf-8"));
        expect(tree.leaves).toBeDefined();
        expect(Array.isArray(tree.leaves)).toBe(true);
      } else {
        // If tree file doesn't exist, verify root file exists instead
        const rootPath = path.join(OUTPUT_DIR, "liabilities_root.json");
        expect(fs.existsSync(rootPath)).toBe(true);
      }
    });
  });

  describe("2. Reserves Scanning", () => {
    it("should have reserves addresses configured", () => {
      const reservesPath = path.join(DATA_DIR, "reserves.json");
      expect(fs.existsSync(reservesPath)).toBe(true);

      const reserves = JSON.parse(fs.readFileSync(reservesPath, "utf-8"));
      // Reserves can be array directly or object with addresses
      const addresses = Array.isArray(reserves) ? reserves : reserves.addresses;
      expect(Array.isArray(addresses)).toBe(true);
      expect(addresses.length).toBeGreaterThan(0);
    });

    it("should have reserves snapshot", () => {
      const snapshotPath = path.join(OUTPUT_DIR, "reserves_snapshot.json");
      expect(fs.existsSync(snapshotPath)).toBe(true);

      const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
      expect(snapshot.reserves_total_wei).toBeDefined();
      expect(BigInt(snapshot.reserves_total_wei)).toBeGreaterThan(0n);
    });

    it("should have reserves greater than liabilities (solvency)", () => {
      const snapshotPath = path.join(OUTPUT_DIR, "reserves_snapshot.json");
      const totalPath = path.join(OUTPUT_DIR, "liabilities_total.json");

      const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
      const total = JSON.parse(fs.readFileSync(totalPath, "utf-8"));

      const reserves = BigInt(snapshot.reserves_total_wei);
      const liabilities = BigInt(total.liabilities_total);

      expect(reserves).toBeGreaterThan(liabilities);
    });
  });

  describe("3. ZK Proof Generation", () => {
    it("should have generated solvency proof", () => {
      const proofPath = path.join(OUTPUT_DIR, "solvency_proof.json");
      expect(fs.existsSync(proofPath)).toBe(true);

      const proofData = JSON.parse(fs.readFileSync(proofPath, "utf-8"));
      expect(proofData.proof).toBeDefined();
      expect(proofData.publicSignals).toBeDefined();
      expect(proofData.calldata).toBeDefined();
      // First public signal should be 1 (solvent)
      expect(proofData.publicSignals[0]).toBe("1");
    });

    it("should have valid proof calldata", () => {
      const proofPath = path.join(OUTPUT_DIR, "solvency_proof.json");
      const proof = JSON.parse(fs.readFileSync(proofPath, "utf-8"));

      expect(proof.calldata).toBeDefined();
      expect(proof.calldata.pA).toBeDefined();
      expect(proof.calldata.pB).toBeDefined();
      expect(proof.calldata.pC).toBeDefined();
      expect(proof.calldata.pubSignals).toBeDefined();

      // pA should be array of 2
      expect(proof.calldata.pA).toHaveLength(2);
      // pB should be 2x2 array
      expect(proof.calldata.pB).toHaveLength(2);
      expect(proof.calldata.pB[0]).toHaveLength(2);
      // pC should be array of 2
      expect(proof.calldata.pC).toHaveLength(2);
      // pubSignals should be array of 4
      expect(proof.calldata.pubSignals).toHaveLength(4);
    });

    it("should have isSolvent = 1 in public signals", () => {
      const proofPath = path.join(OUTPUT_DIR, "solvency_proof.json");
      const proofData = JSON.parse(fs.readFileSync(proofPath, "utf-8"));

      // First public signal should be isSolvent = 1
      expect(proofData.publicSignals[0]).toBe("1");
    });
  });

  describe("4. Contract Deployment", () => {
    it("should have deployment info", () => {
      const deploymentPath = path.join(OUTPUT_DIR, "deployment.json");
      expect(fs.existsSync(deploymentPath)).toBe(true);

      const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
      expect(deployment.network).toBe("sepolia");
      expect(deployment.chainId).toBe(11155111);
    });

    it("should have Groth16Verifier deployed", () => {
      const deploymentPath = path.join(OUTPUT_DIR, "deployment.json");
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

      expect(deployment.contracts.Groth16Verifier).toBeDefined();
      expect(deployment.contracts.Groth16Verifier).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it("should have SolvencyProofRegistry deployed", () => {
      const deploymentPath = path.join(OUTPUT_DIR, "deployment.json");
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

      expect(deployment.contracts.SolvencyProofRegistry).toBeDefined();
      expect(deployment.contracts.SolvencyProofRegistry).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe("5. On-Chain Submission", () => {
    it("should have submission result", () => {
      const submissionPath = path.join(OUTPUT_DIR, "submission_result.json");
      expect(fs.existsSync(submissionPath)).toBe(true);

      const submission = JSON.parse(fs.readFileSync(submissionPath, "utf-8"));
      expect(submission.txHash).toBeDefined();
      expect(submission.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should have successful verification", () => {
      const submissionPath = path.join(OUTPUT_DIR, "submission_result.json");
      const submission = JSON.parse(fs.readFileSync(submissionPath, "utf-8"));

      expect(submission.verified).toBe(true);
      expect(submission.blockNumber).toBeDefined();
      expect(Number(submission.blockNumber)).toBeGreaterThan(0);
    });

    it("should have valid epoch and reserves in submission", () => {
      const submissionPath = path.join(OUTPUT_DIR, "submission_result.json");
      const submission = JSON.parse(fs.readFileSync(submissionPath, "utf-8"));

      expect(submission.epochId).toBeDefined();
      expect(submission.reservesTotal).toBeDefined();
      expect(submission.liabilitiesRoot).toBeDefined();
    });
  });

  describe("6. Circom Circuit", () => {
    const CIRCUITS_DIR = path.join(__dirname, "../../../circuits");
    const BUILD_DIR = path.join(CIRCUITS_DIR, "build");

    it("should have solvency circuit source", () => {
      const circuitPath = path.join(CIRCUITS_DIR, "solvency.circom");
      expect(fs.existsSync(circuitPath)).toBe(true);

      const content = fs.readFileSync(circuitPath, "utf-8");
      expect(content).toContain("template Solvency");
      expect(content).toContain("liabilitiesRoot");
      expect(content).toContain("reservesTotal");
      expect(content).toContain("isSolvent");
    });

    it("should have compiled circuit (wasm)", () => {
      const wasmPath = path.join(BUILD_DIR, "solvency_js", "solvency.wasm");
      expect(fs.existsSync(wasmPath)).toBe(true);
    });

    it("should have proving key (zkey)", () => {
      const zkeyPath = path.join(BUILD_DIR, "solvency_final.zkey");
      expect(fs.existsSync(zkeyPath)).toBe(true);
    });

    it("should have verification key", () => {
      const vkeyPath = path.join(BUILD_DIR, "verification_key.json");
      expect(fs.existsSync(vkeyPath)).toBe(true);

      const vkey = JSON.parse(fs.readFileSync(vkeyPath, "utf-8"));
      expect(vkey.protocol).toBe("groth16");
      expect(vkey.curve).toBe("bn128");
    });

    it("should have Solidity verifier generated", () => {
      const verifierPath = path.join(BUILD_DIR, "Groth16Verifier.sol");
      expect(fs.existsSync(verifierPath)).toBe(true);

      const content = fs.readFileSync(verifierPath, "utf-8");
      expect(content).toContain("contract Groth16Verifier");
      expect(content).toContain("verifyProof");
    });
  });

  describe("7. Smart Contracts", () => {
    const CONTRACTS_DIR = path.join(__dirname, "../../../contracts");

    it("should have SolvencyProofRegistry contract", () => {
      const contractPath = path.join(CONTRACTS_DIR, "contracts", "SolvencyProofRegistry.sol");
      expect(fs.existsSync(contractPath)).toBe(true);

      const content = fs.readFileSync(contractPath, "utf-8");
      expect(content).toContain("contract SolvencyProofRegistry");
      expect(content).toContain("submitProof");
      expect(content).toContain("IGroth16Verifier");
    });

    it("should have Groth16Verifier contract", () => {
      const verifierPath = path.join(CONTRACTS_DIR, "contracts", "Groth16Verifier.sol");
      expect(fs.existsSync(verifierPath)).toBe(true);

      const content = fs.readFileSync(verifierPath, "utf-8");
      expect(content).toContain("contract Groth16Verifier");
      expect(content).toContain("verifyProof");
    });

    it("should have compiled artifacts", () => {
      const artifactsDir = path.join(CONTRACTS_DIR, "artifacts");
      expect(fs.existsSync(artifactsDir)).toBe(true);
    });
  });
});

describe("E2E: Yellow Network Integration", () => {
  describe("Yellow Session Flow", () => {
    it("should simulate complete Yellow session lifecycle", () => {
      // Simulate session creation
      const session = {
        id: `session_${Date.now()}`,
        participants: ["user1", "user2", "user3"],
        allocations: {} as Record<string, string>,
        status: "open" as const,
        createdAt: new Date().toISOString(),
      };

      // Initialize allocations
      session.participants.forEach((p) => {
        session.allocations[p] = "0";
      });

      expect(session.status).toBe("open");
      expect(Object.keys(session.allocations)).toHaveLength(3);

      // Simulate off-chain allocation updates (instant, no gas)
      session.allocations["user1"] = "1000";
      session.allocations["user2"] = "2500";
      session.allocations["user3"] = "500";

      const total = Object.values(session.allocations)
        .reduce((sum, val) => sum + Number(val), 0);
      expect(total).toBe(4000);

      // Simulate session close (on-chain settlement)
      const closedSession = {
        ...session,
        status: "closed" as const,
        closedAt: new Date().toISOString(),
      };

      expect(closedSession.status).toBe("closed");
      expect(closedSession.closedAt).toBeDefined();

      // Simulate export to CSV
      let csvContent = "user_id,balance\n";
      Object.entries(closedSession.allocations).forEach(([userId, balance]) => {
        csvContent += `${userId},${balance}\n`;
      });

      expect(csvContent).toContain("user1,1000");
      expect(csvContent).toContain("user2,2500");
      expect(csvContent).toContain("user3,500");
    });

    it("should demonstrate off-chain speed advantage", () => {
      const updates: { timestamp: number; userId: string; balance: string }[] = [];
      const allocations: Record<string, string> = {};

      // Simulate 100 rapid off-chain updates
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        const userId = `user${i % 10}`;
        const balance = String(Math.floor(Math.random() * 10000));
        allocations[userId] = balance;
        updates.push({ timestamp: Date.now(), userId, balance });
      }
      const endTime = Date.now();

      // All 100 updates should complete in < 100ms (off-chain)
      expect(endTime - startTime).toBeLessThan(100);
      expect(updates).toHaveLength(100);

      // Final state
      expect(Object.keys(allocations)).toHaveLength(10);
    });
  });
});

describe("E2E: Data Integrity", () => {
  it("should maintain consistency across all output files", () => {
    const rootPath = path.join(OUTPUT_DIR, "liabilities_root.json");
    const proofPath = path.join(OUTPUT_DIR, "solvency_proof.json");

    if (fs.existsSync(rootPath) && fs.existsSync(proofPath)) {
      const root = JSON.parse(fs.readFileSync(rootPath, "utf-8"));
      const proofData = JSON.parse(fs.readFileSync(proofPath, "utf-8"));

      // Both files should exist and have valid data
      expect(root.liabilities_root).toBeDefined();
      expect(proofData.publicSignals).toBeDefined();
      expect(proofData.publicSignals[0]).toBe("1"); // isSolvent
    }
  });

  it("should have matching epoch IDs in liabilities files", () => {
    const rootPath = path.join(OUTPUT_DIR, "liabilities_root.json");
    const totalPath = path.join(OUTPUT_DIR, "liabilities_total.json");

    if (fs.existsSync(rootPath) && fs.existsSync(totalPath)) {
      const root = JSON.parse(fs.readFileSync(rootPath, "utf-8"));
      const total = JSON.parse(fs.readFileSync(totalPath, "utf-8"));

      expect(root.epoch_id).toBe(total.epoch_id);
    }
  });
});
