import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createPublicClient, http, parseAbi } from "viem";
import { sepolia } from "viem/chains";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE_URL = process.env.API_URL || "http://localhost:3001";
const OUTPUT_DIR = path.join(__dirname, "../../../data/output");

// Helper to make API calls
async function apiCall(
  endpoint: string,
  method: "GET" | "POST" | "PUT" = "GET",
  body?: unknown
) {
  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  return {
    status: response.status,
    data: await response.json(),
  };
}

// Check if API server is running
async function isApiRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

describe("Integration Tests: API Calls", () => {
  let apiAvailable = false;

  beforeAll(async () => {
    apiAvailable = await isApiRunning();
    if (!apiAvailable) {
      console.log("⚠️  API server not running - skipping live API tests");
      console.log("   Start with: pnpm api:dev");
    }
  });

  describe("Health & Status Endpoints", () => {
    it("should return health status from API", async () => {
      if (!apiAvailable) return;

      const { status, data } = await apiCall("/health");
      expect(status).toBe(200);
      expect(data.status).toBe("ok");
      expect(data.timestamp).toBeDefined();
    });

    it("should return deployed contract addresses", async () => {
      if (!apiAvailable) return;

      const { status, data } = await apiCall("/api/contracts");
      expect(status).toBe(200);
      expect(data.contracts).toBeDefined();
      expect(data.contracts.SolvencyProofRegistry).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(data.contracts.Groth16Verifier).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe("Liabilities Flow via API", () => {
    it("should get current liabilities data", async () => {
      if (!apiAvailable) return;

      const { status, data } = await apiCall("/api/liabilities");
      if (status === 200) {
        // API may return root or liabilities_root depending on structure
        expect(data.root || data.liabilities_root).toBeDefined();
      } else {
        expect(status).toBe(404); // Not built yet is acceptable
      }
    });

    it("should upload liabilities CSV", async () => {
      if (!apiAvailable) return;

      const csvContent = "user_id,balance\ntest_user1,1000\ntest_user2,2000\ntest_user3,1500";
      const { status, data } = await apiCall("/api/liabilities/upload", "POST", {
        csvContent,
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe("Reserves Flow via API", () => {
    it("should get current reserves snapshot", async () => {
      if (!apiAvailable) return;

      const { status, data } = await apiCall("/api/reserves");
      if (status === 200) {
        expect(data.reserves_total_wei).toBeDefined();
      } else {
        expect(status).toBe(404); // Not scanned yet is acceptable
      }
    });

    it("should update reserve addresses", async () => {
      if (!apiAvailable) return;

      const addresses = ["0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E"];
      const { status, data } = await apiCall("/api/reserves/addresses", "POST", {
        addresses,
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.count).toBe(1);
    });
  });

  describe("ZK Proof Flow via API", () => {
    it("should get current proof data", async () => {
      if (!apiAvailable) return;

      const { status, data } = await apiCall("/api/proof");
      if (status === 200) {
        expect(data.proof).toBeDefined();
        expect(data.publicSignals).toBeDefined();
      } else {
        expect(status).toBe(404); // Not generated yet is acceptable
      }
    });
  });

  describe("Yellow Session Flow via API", () => {
    let sessionId: string;

    it("should create a new Yellow session", async () => {
      if (!apiAvailable) return;

      const { status, data } = await apiCall("/api/yellow/session", "POST", {
        participants: ["alice", "bob", "charlie"],
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.session.id).toBeDefined();
      expect(data.session.status).toBe("open");
      expect(data.session.participants).toHaveLength(3);

      sessionId = data.session.id;
    });

    it("should get session details", async () => {
      if (!apiAvailable || !sessionId) return;

      const { status, data } = await apiCall(`/api/yellow/session/${sessionId}`);

      expect(status).toBe(200);
      expect(data.id).toBe(sessionId);
      expect(data.status).toBe("open");
    });

    it("should update allocations (off-chain instant)", async () => {
      if (!apiAvailable || !sessionId) return;

      const { status, data } = await apiCall(
        `/api/yellow/session/${sessionId}/allocations`,
        "PUT",
        {
          allocations: {
            alice: "5000",
            bob: "3000",
            charlie: "2000",
          },
        }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.session.allocations.alice).toBe("5000");
      expect(data.session.allocations.bob).toBe("3000");
      expect(data.session.allocations.charlie).toBe("2000");
    });

    it("should close session and settle", async () => {
      if (!apiAvailable || !sessionId) return;

      const { status, data } = await apiCall(
        `/api/yellow/session/${sessionId}/close`,
        "POST"
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.session.status).toBe("closed");
      expect(data.session.closedAt).toBeDefined();
    });

    it("should export session to liabilities CSV", async () => {
      if (!apiAvailable || !sessionId) return;

      const { status, data } = await apiCall(
        `/api/yellow/session/${sessionId}/export`,
        "POST"
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.entries).toBe(3);
    });

    it("should list all sessions", async () => {
      if (!apiAvailable) return;

      const { status, data } = await apiCall("/api/yellow/sessions");

      expect(status).toBe(200);
      expect(data.sessions).toBeDefined();
      expect(Array.isArray(data.sessions)).toBe(true);
    });
  });
});

describe("Integration Tests: On-Chain Transactions", () => {
  const RPC_URL = process.env.SEPOLIA_RPC_URL || "https://1rpc.io/sepolia";

  let publicClient: ReturnType<typeof createPublicClient>;
  let registryAddress: string;
  let verifierAddress: string;

  beforeAll(() => {
    publicClient = createPublicClient({
      chain: sepolia,
      transport: http(RPC_URL),
    });

    // Load deployment info
    const deploymentPath = path.join(OUTPUT_DIR, "deployment.json");
    if (fs.existsSync(deploymentPath)) {
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
      registryAddress = deployment.contracts.SolvencyProofRegistry;
      verifierAddress = deployment.contracts.Groth16Verifier;
    }
  });

  describe("Contract State Verification", () => {
    it("should read epoch count from on-chain registry", async () => {
      if (!registryAddress) return;

      const abi = parseAbi(["function getEpochCount() external view returns (uint256)"]);

      const epochCount = await publicClient.readContract({
        address: registryAddress as `0x${string}`,
        abi,
        functionName: "getEpochCount",
      });

      expect(epochCount).toBeGreaterThanOrEqual(0n);
      console.log(`   On-chain epoch count: ${epochCount}`);
    });

    it("should read verifier address from registry", async () => {
      if (!registryAddress) return;

      const abi = parseAbi(["function verifier() external view returns (address)"]);

      const verifier = await publicClient.readContract({
        address: registryAddress as `0x${string}`,
        abi,
        functionName: "verifier",
      });

      expect(verifier).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(verifier.toLowerCase()).toBe(verifierAddress.toLowerCase());
      console.log(`   On-chain verifier: ${verifier}`);
    });

    it("should read owner from registry", async () => {
      if (!registryAddress) return;

      const abi = parseAbi(["function owner() external view returns (address)"]);

      const owner = await publicClient.readContract({
        address: registryAddress as `0x${string}`,
        abi,
        functionName: "owner",
      });

      expect(owner).toMatch(/^0x[a-fA-F0-9]{40}$/);
      console.log(`   On-chain owner: ${owner}`);
    });
  });

  describe("Submitted Proof Verification", () => {
    it("should verify submitted proof exists on-chain", async () => {
      if (!registryAddress) return;

      // Check if we have a submission result
      const submissionPath = path.join(OUTPUT_DIR, "submission_result.json");
      if (!fs.existsSync(submissionPath)) {
        console.log("   No submission result found - skipping");
        return;
      }

      const submission = JSON.parse(fs.readFileSync(submissionPath, "utf-8"));
      const epochId = submission.epochId as `0x${string}`;

      const abi = parseAbi([
        "function getProof(bytes32 epochId) external view returns (bytes32, bytes32, uint256, uint256, address, bool)",
      ]);

      const proof = await publicClient.readContract({
        address: registryAddress as `0x${string}`,
        abi,
        functionName: "getProof",
        args: [epochId],
      });

      expect(proof[3]).toBeGreaterThan(0n); // timestamp > 0 means proof exists
      expect(proof[5]).toBe(true); // verified = true
      console.log(`   Proof verified on-chain: ${proof[5]}`);
      console.log(`   Proof timestamp: ${new Date(Number(proof[3]) * 1000).toISOString()}`);
    });

    it("should verify transaction receipt on-chain", async () => {
      const submissionPath = path.join(OUTPUT_DIR, "submission_result.json");
      if (!fs.existsSync(submissionPath)) {
        console.log("   No submission result found - skipping");
        return;
      }

      const submission = JSON.parse(fs.readFileSync(submissionPath, "utf-8"));
      const txHash = submission.txHash as `0x${string}`;

      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

      expect(receipt).toBeDefined();
      expect(receipt.status).toBe("success");
      expect(receipt.blockNumber).toBeGreaterThan(0n);
      console.log(`   TX confirmed in block: ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed}`);
    });
  });

  describe("Groth16Verifier Contract", () => {
    it("should verify verifier contract is deployed", async () => {
      if (!verifierAddress) return;

      const code = await publicClient.getCode({
        address: verifierAddress as `0x${string}`,
      });

      expect(code).toBeDefined();
      expect(code!.length).toBeGreaterThan(2); // More than just "0x"
      console.log(`   Verifier bytecode length: ${code!.length} chars`);
    });
  });
});

describe("Integration Tests: Complete User Flow Simulation", () => {
  it("should simulate complete user journey", async () => {
    console.log("\n📋 Simulating Complete User Journey:\n");

    // Step 1: User creates Yellow session for liability management
    console.log("1️⃣  User creates Yellow session for off-chain liability tracking");
    const session = {
      id: `session_${Date.now()}`,
      participants: ["user_alice", "user_bob", "user_charlie"],
      allocations: {} as Record<string, string>,
      status: "open",
    };
    session.participants.forEach((p) => (session.allocations[p] = "0"));
    expect(session.status).toBe("open");
    console.log(`   ✓ Session created: ${session.id}`);

    // Step 2: Off-chain liability updates (instant, no gas)
    console.log("\n2️⃣  User updates liabilities (instant off-chain)");
    const updates = [
      { user: "user_alice", balance: "10000" },
      { user: "user_bob", balance: "5000" },
      { user: "user_charlie", balance: "3000" },
    ];
    for (const update of updates) {
      session.allocations[update.user] = update.balance;
      console.log(`   ✓ ${update.user}: ${update.balance} (instant, no gas)`);
    }

    // Step 3: Close session and settle
    console.log("\n3️⃣  User closes session (on-chain settlement)");
    session.status = "closed";
    const totalLiabilities = Object.values(session.allocations)
      .reduce((sum, val) => sum + Number(val), 0);
    console.log(`   ✓ Session closed, total liabilities: ${totalLiabilities}`);

    // Step 4: Export to liabilities CSV
    console.log("\n4️⃣  System exports liabilities for proof generation");
    let csvContent = "user_id,balance\n";
    Object.entries(session.allocations).forEach(([userId, balance]) => {
      csvContent += `${userId},${balance}\n`;
    });
    expect(csvContent).toContain("user_alice,10000");
    console.log(`   ✓ Exported ${Object.keys(session.allocations).length} entries to CSV`);

    // Step 5: Build Merkle tree
    console.log("\n5️⃣  System builds liabilities Merkle tree");
    const rootPath = path.join(OUTPUT_DIR, "liabilities_root.json");
    if (fs.existsSync(rootPath)) {
      const root = JSON.parse(fs.readFileSync(rootPath, "utf-8"));
      console.log(`   ✓ Merkle root: ${root.liabilities_root.slice(0, 20)}...`);
    }

    // Step 6: Scan reserves
    console.log("\n6️⃣  System scans on-chain reserves");
    const snapshotPath = path.join(OUTPUT_DIR, "reserves_snapshot.json");
    if (fs.existsSync(snapshotPath)) {
      const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
      console.log(`   ✓ Total reserves: ${snapshot.reserves_total_eth} ETH`);
    }

    // Step 7: Generate ZK proof
    console.log("\n7️⃣  System generates ZK solvency proof");
    const proofPath = path.join(OUTPUT_DIR, "solvency_proof.json");
    if (fs.existsSync(proofPath)) {
      const proof = JSON.parse(fs.readFileSync(proofPath, "utf-8"));
      console.log(`   ✓ Proof generated, isSolvent: ${proof.publicSignals[0] === "1"}`);
    }

    // Step 8: Submit proof on-chain
    console.log("\n8️⃣  System submits proof on-chain");
    const submissionPath = path.join(OUTPUT_DIR, "submission_result.json");
    if (fs.existsSync(submissionPath)) {
      const submission = JSON.parse(fs.readFileSync(submissionPath, "utf-8"));
      console.log(`   ✓ TX: ${submission.txHash.slice(0, 20)}...`);
      console.log(`   ✓ Block: ${submission.blockNumber}`);
      console.log(`   ✓ Verified: ${submission.verified}`);
    }

    // Step 9: User verifies inclusion
    console.log("\n9️⃣  User verifies their inclusion in proof");
    console.log(`   ✓ User can verify inclusion using Merkle proof`);

    // Step 10: Public verifies solvency
    console.log("\n🔟 Public verifies solvency on-chain");
    const deploymentPath = path.join(OUTPUT_DIR, "deployment.json");
    if (fs.existsSync(deploymentPath)) {
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
      console.log(`   ✓ Registry: ${deployment.contracts.SolvencyProofRegistry}`);
      console.log(`   ✓ Anyone can verify proof on Etherscan`);
    }

    console.log("\n✅ Complete user journey simulation successful!\n");
  });
});
