import { describe, it, expect, beforeAll } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  formatEther,
} from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

const OUTPUT_DIR = path.join(__dirname, "../../../data/output");
const RPC_URL = process.env.SEPOLIA_RPC_URL || "https://1rpc.io/sepolia";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

describe("On-Chain Tests: Real Blockchain Transactions", () => {
  let publicClient: ReturnType<typeof createPublicClient>;
  let walletClient: ReturnType<typeof createWalletClient>;
  let account: ReturnType<typeof privateKeyToAccount>;
  let registryAddress: string;
  let verifierAddress: string;
  let hasPrivateKey = false;

  beforeAll(() => {
    publicClient = createPublicClient({
      chain: sepolia,
      transport: http(RPC_URL),
    });

    // Check if we have private key for write operations
    if (PRIVATE_KEY) {
      hasPrivateKey = true;
      account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
      walletClient = createWalletClient({
        account,
        chain: sepolia,
        transport: http(RPC_URL),
      });
    }

    // Load deployment info
    const deploymentPath = path.join(OUTPUT_DIR, "deployment.json");
    if (fs.existsSync(deploymentPath)) {
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
      registryAddress = deployment.contracts.SolvencyProofRegistry;
      verifierAddress = deployment.contracts.Groth16Verifier;
    }
  });

  describe("1. Wallet & Network Verification", () => {
    it("should connect to Sepolia network", async () => {
      const chainId = await publicClient.getChainId();
      expect(chainId).toBe(11155111);
      console.log(`   ✓ Connected to Sepolia (chainId: ${chainId})`);
    });

    it("should get current block number", async () => {
      const blockNumber = await publicClient.getBlockNumber();
      expect(blockNumber).toBeGreaterThan(0n);
      console.log(`   ✓ Current block: ${blockNumber}`);
    });

    it("should verify wallet has ETH balance", async () => {
      if (!hasPrivateKey) {
        console.log("   ⚠️  No private key - skipping wallet balance check");
        return;
      }

      const balance = await publicClient.getBalance({
        address: account.address,
      });

      expect(balance).toBeGreaterThan(0n);
      console.log(`   ✓ Wallet: ${account.address}`);
      console.log(`   ✓ Balance: ${formatEther(balance)} ETH`);
    });
  });

  describe("2. Contract Deployment Verification", () => {
    it("should verify SolvencyProofRegistry is deployed", async () => {
      if (!registryAddress) {
        console.log("   ⚠️  No deployment info found");
        return;
      }

      const code = await publicClient.getCode({
        address: registryAddress as `0x${string}`,
      });

      expect(code).toBeDefined();
      expect(code!.length).toBeGreaterThan(2);
      console.log(`   ✓ Registry deployed at: ${registryAddress}`);
      console.log(`   ✓ Contract bytecode size: ${(code!.length - 2) / 2} bytes`);
    });

    it("should verify Groth16Verifier is deployed", async () => {
      if (!verifierAddress) {
        console.log("   ⚠️  No deployment info found");
        return;
      }

      const code = await publicClient.getCode({
        address: verifierAddress as `0x${string}`,
      });

      expect(code).toBeDefined();
      expect(code!.length).toBeGreaterThan(2);
      console.log(`   ✓ Verifier deployed at: ${verifierAddress}`);
      console.log(`   ✓ Contract bytecode size: ${(code!.length - 2) / 2} bytes`);
    });
  });

  describe("3. On-Chain State Reading", () => {
    it("should read registry owner from chain", async () => {
      if (!registryAddress) return;

      const abi = parseAbi(["function owner() external view returns (address)"]);

      const owner = await publicClient.readContract({
        address: registryAddress as `0x${string}`,
        abi,
        functionName: "owner",
      });

      expect(owner).toMatch(/^0x[a-fA-F0-9]{40}$/);
      console.log(`   ✓ Registry owner: ${owner}`);
    });

    it("should read verifier address from registry", async () => {
      if (!registryAddress) return;

      const abi = parseAbi(["function verifier() external view returns (address)"]);

      const verifier = await publicClient.readContract({
        address: registryAddress as `0x${string}`,
        abi,
        functionName: "verifier",
      });

      expect(verifier.toLowerCase()).toBe(verifierAddress.toLowerCase());
      console.log(`   ✓ Verifier linked: ${verifier}`);
    });

    it("should read epoch count from registry", async () => {
      if (!registryAddress) return;

      const abi = parseAbi(["function getEpochCount() external view returns (uint256)"]);

      const count = await publicClient.readContract({
        address: registryAddress as `0x${string}`,
        abi,
        functionName: "getEpochCount",
      });

      expect(count).toBeGreaterThanOrEqual(0n);
      console.log(`   ✓ Total epochs submitted: ${count}`);
    });
  });

  describe("4. Submitted Proof On-Chain Verification", () => {
    it("should verify proof exists on-chain", async () => {
      if (!registryAddress) return;

      const submissionPath = path.join(OUTPUT_DIR, "submission_result.json");
      if (!fs.existsSync(submissionPath)) {
        console.log("   ⚠️  No submission found - run submit:proof first");
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

      // proof[3] = timestamp, proof[5] = verified
      expect(proof[3]).toBeGreaterThan(0n);
      expect(proof[5]).toBe(true);

      console.log(`   ✓ Epoch ID: ${epochId.slice(0, 20)}...`);
      console.log(`   ✓ Liabilities Root: ${proof[1].slice(0, 20)}...`);
      console.log(`   ✓ Reserves Total: ${proof[2]} wei`);
      console.log(`   ✓ Timestamp: ${new Date(Number(proof[3]) * 1000).toISOString()}`);
      console.log(`   ✓ Submitter: ${proof[4]}`);
      console.log(`   ✓ Verified: ${proof[5]}`);
    });

    it("should get latest epoch from registry", async () => {
      if (!registryAddress) return;

      const countAbi = parseAbi(["function getEpochCount() external view returns (uint256)"]);
      const count = await publicClient.readContract({
        address: registryAddress as `0x${string}`,
        abi: countAbi,
        functionName: "getEpochCount",
      });

      if (count === 0n) {
        console.log("   ⚠️  No epochs submitted yet");
        return;
      }

      const latestAbi = parseAbi(["function getLatestEpoch() external view returns (bytes32)"]);
      const latestEpoch = await publicClient.readContract({
        address: registryAddress as `0x${string}`,
        abi: latestAbi,
        functionName: "getLatestEpoch",
      });

      expect(latestEpoch).toMatch(/^0x[a-fA-F0-9]{64}$/);
      console.log(`   ✓ Latest epoch: ${latestEpoch.slice(0, 20)}...`);
    });
  });

  describe("5. Transaction Receipt Verification", () => {
    it("should verify proof submission TX on-chain", async () => {
      const submissionPath = path.join(OUTPUT_DIR, "submission_result.json");
      if (!fs.existsSync(submissionPath)) {
        console.log("   ⚠️  No submission found");
        return;
      }

      const submission = JSON.parse(fs.readFileSync(submissionPath, "utf-8"));
      const txHash = submission.txHash as `0x${string}`;

      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

      expect(receipt.status).toBe("success");
      expect(receipt.blockNumber).toBeGreaterThan(0n);

      console.log(`   ✓ TX Hash: ${txHash}`);
      console.log(`   ✓ Status: ${receipt.status}`);
      console.log(`   ✓ Block: ${receipt.blockNumber}`);
      console.log(`   ✓ Gas Used: ${receipt.gasUsed}`);
      console.log(`   ✓ From: ${receipt.from}`);
      console.log(`   ✓ To: ${receipt.to}`);
    });

    it("should get transaction details from chain", async () => {
      const submissionPath = path.join(OUTPUT_DIR, "submission_result.json");
      if (!fs.existsSync(submissionPath)) {
        console.log("   ⚠️  No submission found");
        return;
      }

      const submission = JSON.parse(fs.readFileSync(submissionPath, "utf-8"));
      const txHash = submission.txHash as `0x${string}`;

      const tx = await publicClient.getTransaction({ hash: txHash });

      expect(tx.hash).toBe(txHash);
      console.log(`   ✓ Nonce: ${tx.nonce}`);
      console.log(`   ✓ Gas Price: ${tx.gasPrice ? formatEther(tx.gasPrice) : 'N/A'} ETH`);
      console.log(`   ✓ Value: ${formatEther(tx.value)} ETH`);
    });

    it("should get block details for submission", async () => {
      const submissionPath = path.join(OUTPUT_DIR, "submission_result.json");
      if (!fs.existsSync(submissionPath)) {
        console.log("   ⚠️  No submission found");
        return;
      }

      const submission = JSON.parse(fs.readFileSync(submissionPath, "utf-8"));
      const txHash = submission.txHash as `0x${string}`;

      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
      const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });

      expect(block.number).toBe(receipt.blockNumber);
      console.log(`   ✓ Block Number: ${block.number}`);
      console.log(`   ✓ Block Hash: ${block.hash?.slice(0, 20)}...`);
      console.log(`   ✓ Block Time: ${new Date(Number(block.timestamp) * 1000).toISOString()}`);
      console.log(`   ✓ Transactions in block: ${block.transactions.length}`);
    });
  });

  describe("6. Etherscan Links", () => {
    it("should generate Etherscan verification links", async () => {
      const submissionPath = path.join(OUTPUT_DIR, "submission_result.json");
      if (!fs.existsSync(submissionPath)) {
        console.log("   ⚠️  No submission found");
        return;
      }

      const submission = JSON.parse(fs.readFileSync(submissionPath, "utf-8"));

      console.log("\n   📋 Verify on Etherscan:");
      console.log(`   ✓ TX: https://sepolia.etherscan.io/tx/${submission.txHash}`);
      console.log(`   ✓ Registry: https://sepolia.etherscan.io/address/${registryAddress}`);
      console.log(`   ✓ Verifier: https://sepolia.etherscan.io/address/${verifierAddress}`);

      expect(submission.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });
});

describe("On-Chain Tests: Groth16 Verifier", () => {
  let publicClient: ReturnType<typeof createPublicClient>;
  let verifierAddress: string;

  beforeAll(() => {
    publicClient = createPublicClient({
      chain: sepolia,
      transport: http(RPC_URL),
    });

    const deploymentPath = path.join(OUTPUT_DIR, "deployment.json");
    if (fs.existsSync(deploymentPath)) {
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
      verifierAddress = deployment.contracts.Groth16Verifier;
    }
  });

  it("should call verifyProof with invalid proof (should return false)", async () => {
    if (!verifierAddress) return;

    const abi = parseAbi([
      "function verifyProof(uint256[2] calldata _pA, uint256[2][2] calldata _pB, uint256[2] calldata _pC, uint256[4] calldata _pubSignals) external view returns (bool)",
    ]);

    // Invalid proof (all zeros)
    const pA: [bigint, bigint] = [0n, 0n];
    const pB: [[bigint, bigint], [bigint, bigint]] = [[0n, 0n], [0n, 0n]];
    const pC: [bigint, bigint] = [0n, 0n];
    const pubSignals: [bigint, bigint, bigint, bigint] = [1n, 0n, 0n, 0n];

    const result = await publicClient.readContract({
      address: verifierAddress as `0x${string}`,
      abi,
      functionName: "verifyProof",
      args: [pA, pB, pC, pubSignals],
    });

    expect(result).toBe(false);
    console.log(`   ✓ Invalid proof correctly rejected by on-chain verifier`);
  });

  it("should verify the actual submitted proof on-chain", async () => {
    if (!verifierAddress) return;

    const proofPath = path.join(OUTPUT_DIR, "solvency_proof.json");
    if (!fs.existsSync(proofPath)) {
      console.log("   ⚠️  No proof found");
      return;
    }

    const proofData = JSON.parse(fs.readFileSync(proofPath, "utf-8"));

    const abi = parseAbi([
      "function verifyProof(uint256[2] calldata _pA, uint256[2][2] calldata _pB, uint256[2] calldata _pC, uint256[4] calldata _pubSignals) external view returns (bool)",
    ]);

    // Use actual proof data
    const pA: [bigint, bigint] = [
      BigInt(proofData.proof.pi_a[0]),
      BigInt(proofData.proof.pi_a[1]),
    ];
    const pB: [[bigint, bigint], [bigint, bigint]] = [
      [BigInt(proofData.proof.pi_b[0][1]), BigInt(proofData.proof.pi_b[0][0])],
      [BigInt(proofData.proof.pi_b[1][1]), BigInt(proofData.proof.pi_b[1][0])],
    ];
    const pC: [bigint, bigint] = [
      BigInt(proofData.proof.pi_c[0]),
      BigInt(proofData.proof.pi_c[1]),
    ];
    const pubSignals: [bigint, bigint, bigint, bigint] = [
      BigInt(proofData.publicSignals[0]),
      BigInt(proofData.publicSignals[1]),
      BigInt(proofData.publicSignals[2]),
      BigInt(proofData.publicSignals[3]),
    ];

    const result = await publicClient.readContract({
      address: verifierAddress as `0x${string}`,
      abi,
      functionName: "verifyProof",
      args: [pA, pB, pC, pubSignals],
    });

    expect(result).toBe(true);
    console.log(`   ✓ Real proof verified on-chain by Groth16Verifier!`);
    console.log(`   ✓ isSolvent: ${proofData.publicSignals[0] === "1"}`);
  });
});
