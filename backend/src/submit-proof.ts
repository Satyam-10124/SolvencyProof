import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const DATA_DIR = path.join(__dirname, "../../data");
const OUTPUT_DIR = path.join(DATA_DIR, "output");

// Contract ABI for proof submission
const REGISTRY_ABI = parseAbi([
  "function submitProof(bytes32 epochId, bytes32 liabilitiesRoot, uint256 reservesTotal, uint256[2] calldata _pA, uint256[2][2] calldata _pB, uint256[2] calldata _pC, uint256[4] calldata _pubSignals) external",
  "function getProof(bytes32 epochId) external view returns (bytes32, bytes32, uint256, uint256, address, bool)",
  "function getEpochCount() external view returns (uint256)",
]);

async function submitProofOnChain() {
  console.log("🚀 Submitting Solvency Proof On-Chain...\n");

  // Load deployment info
  const deploymentPath = path.join(OUTPUT_DIR, "deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error("Deployment info not found. Deploy contracts first.");
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const registryAddress = deployment.contracts.SolvencyProofRegistry;

  console.log(`📍 Registry: ${registryAddress}`);

  // Load proof
  const proofPath = path.join(OUTPUT_DIR, "solvency_proof.json");
  if (!fs.existsSync(proofPath)) {
    throw new Error("Proof not found. Generate proof first.");
  }
  const proofData = JSON.parse(fs.readFileSync(proofPath, "utf-8"));

  // Load liabilities root
  const rootPath = path.join(OUTPUT_DIR, "liabilities_root.json");
  const rootData = JSON.parse(fs.readFileSync(rootPath, "utf-8"));

  // Setup wallet
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const rpcUrl = process.env.SEPOLIA_RPC_URL || "https://1rpc.io/sepolia";

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  console.log(`👛 Wallet: ${account.address}`);

  // Prepare proof parameters
  const { calldata } = proofData;
  // Convert epochId to bytes32 (pad to 32 bytes)
  const epochIdNum = BigInt(calldata.pubSignals[3]);
  const epochId = ("0x" + epochIdNum.toString(16).padStart(64, "0")) as `0x${string}`;
  const liabilitiesRoot = rootData.liabilities_root as `0x${string}`;
  const reservesTotal = BigInt(calldata.pubSignals[2]);

  // Convert proof arrays to BigInt
  const pA: [bigint, bigint] = [BigInt(calldata.pA[0]), BigInt(calldata.pA[1])];
  const pB: [[bigint, bigint], [bigint, bigint]] = [
    [BigInt(calldata.pB[0][0]), BigInt(calldata.pB[0][1])],
    [BigInt(calldata.pB[1][0]), BigInt(calldata.pB[1][1])],
  ];
  const pC: [bigint, bigint] = [BigInt(calldata.pC[0]), BigInt(calldata.pC[1])];
  
  // Public signals from proof: [isSolvent, liabilitiesRoot, reservesTotal, epochId]
  const pubSignals: [bigint, bigint, bigint, bigint] = [
    BigInt(calldata.pubSignals[0]),
    BigInt(calldata.pubSignals[1]),
    BigInt(calldata.pubSignals[2]),
    BigInt(calldata.pubSignals[3]),
  ];

  console.log("\n📊 Proof Parameters:");
  console.log(`   Epoch ID: ${epochId.slice(0, 20)}...`);
  console.log(`   Liabilities Root: ${liabilitiesRoot.slice(0, 20)}...`);
  console.log(`   Reserves Total: ${reservesTotal} wei`);

  // Check current epoch count
  const epochCountBefore = await publicClient.readContract({
    address: registryAddress as `0x${string}`,
    abi: REGISTRY_ABI,
    functionName: "getEpochCount",
  });
  console.log(`\n📈 Current epoch count: ${epochCountBefore}`);

  // Submit proof
  console.log("\n⏳ Submitting proof transaction...");

  try {
    const hash = await walletClient.writeContract({
      address: registryAddress as `0x${string}`,
      abi: REGISTRY_ABI,
      functionName: "submitProof",
      args: [epochId, liabilitiesRoot, reservesTotal, pA, pB, pC, pubSignals],
    });

    console.log(`📝 Transaction hash: ${hash}`);
    console.log("⏳ Waiting for confirmation...");

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "success") {
      console.log("\n✅ Proof submitted successfully!");
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed}`);

      // Get submitted proof
      const submittedProof = await publicClient.readContract({
        address: registryAddress as `0x${string}`,
        abi: REGISTRY_ABI,
        functionName: "getProof",
        args: [epochId],
      });

      console.log("\n📋 On-Chain Proof:");
      console.log(`   Epoch ID: ${submittedProof[0]}`);
      console.log(`   Liabilities Root: ${submittedProof[1]}`);
      console.log(`   Reserves Total: ${submittedProof[2]} wei`);
      console.log(`   Timestamp: ${new Date(Number(submittedProof[3]) * 1000).toISOString()}`);
      console.log(`   Verified: ${submittedProof[5] ? "✅ YES" : "❌ NO"}`);

      // Save submission result
      const submissionResult = {
        txHash: hash,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        epochId: epochId.toString(),
        liabilitiesRoot,
        reservesTotal: reservesTotal.toString(),
        verified: submittedProof[5],
        timestamp: new Date().toISOString(),
      };

      const submissionPath = path.join(OUTPUT_DIR, "submission_result.json");
      fs.writeFileSync(submissionPath, JSON.stringify(submissionResult, null, 2));
      console.log(`\n💾 Result saved to: ${submissionPath}`);
    } else {
      throw new Error("Transaction failed");
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error("\n❌ Submission failed:", error.message);
    throw error;
  }
}

submitProofOnChain()
  .then(() => {
    console.log("\n🎉 On-chain submission complete!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
  });
