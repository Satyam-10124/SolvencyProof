import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "../../data");
const OUTPUT_DIR = path.join(DATA_DIR, "output");
const CIRCUITS_DIR = path.join(__dirname, "../../circuits/build");

interface ProofInput {
  liabilitiesRoot: string;
  reservesTotal: string;
  epochId: string;
  liabilitiesTotal: string; // private
}

interface Groth16Proof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
}

interface ProofResult {
  proof: Groth16Proof;
  publicSignals: string[];
  calldata: {
    pA: [string, string];
    pB: [[string, string], [string, string]];
    pC: [string, string];
    pubSignals: string[];
  };
}

async function generateProof(): Promise<ProofResult> {
  console.log("🔐 Generating Solvency ZK Proof...\n");

  // Read liabilities Merkle root
  const rootPath = path.join(OUTPUT_DIR, "liabilities_root.json");
  const totalPath = path.join(OUTPUT_DIR, "liabilities_total.json");
  if (!fs.existsSync(rootPath) || !fs.existsSync(totalPath)) {
    throw new Error("Liabilities data not found. Run liabilities-builder first.");
  }
  const rootData = JSON.parse(fs.readFileSync(rootPath, "utf-8"));
  const totalData = JSON.parse(fs.readFileSync(totalPath, "utf-8"));
  const liabilitiesRoot = rootData.liabilities_root;
  const liabilitiesTotal = totalData.liabilities_total;

  console.log("📊 Liabilities:");
  console.log(`   Root: ${liabilitiesRoot.slice(0, 20)}...`);
  console.log(`   Total: ${liabilitiesTotal}`);

  // Read reserves total
  const reservesPath = path.join(OUTPUT_DIR, "reserves_snapshot.json");
  if (!fs.existsSync(reservesPath)) {
    throw new Error("Reserves snapshot not found. Run reserves-scanner first.");
  }
  const reserves = JSON.parse(fs.readFileSync(reservesPath, "utf-8"));
  const reservesTotal = reserves.reserves_total_wei;

  console.log("\n💰 Reserves:");
  console.log(`   Total Wei: ${reservesTotal}`);

  // Create epoch ID based on timestamp
  const epochId = Math.floor(Date.now() / 1000).toString();

  // Verify solvency condition
  const reservesBN = BigInt(reservesTotal);
  const liabilitiesBN = BigInt(liabilitiesTotal);

  if (reservesBN < liabilitiesBN) {
    throw new Error(
      `Insolvency detected! Reserves (${reservesBN}) < Liabilities (${liabilitiesBN})`
    );
  }

  console.log("\n✅ Solvency verified: Reserves >= Liabilities");
  console.log(`   Surplus: ${reservesBN - liabilitiesBN} wei\n`);

  // Prepare circuit input
  const input: ProofInput = {
    liabilitiesRoot: BigInt(liabilitiesRoot).toString(),
    reservesTotal: reservesTotal,
    epochId: epochId,
    liabilitiesTotal: liabilitiesTotal,
  };

  // Write input file
  const inputPath = path.join(CIRCUITS_DIR, "input.json");
  fs.writeFileSync(inputPath, JSON.stringify(input, null, 2));
  console.log("📝 Circuit input written to:", inputPath);

  // Generate witness
  console.log("\n⚙️  Generating witness...");
  const wasmPath = path.join(CIRCUITS_DIR, "solvency_js/solvency.wasm");
  const witnessPath = path.join(CIRCUITS_DIR, "witness.wtns");

  execSync(
    `node ${path.join(CIRCUITS_DIR, "solvency_js/generate_witness.js")} ${wasmPath} ${inputPath} ${witnessPath}`,
    { stdio: "inherit" }
  );

  // Generate proof
  console.log("\n🔮 Generating Groth16 proof...");
  const zkeyPath = path.join(CIRCUITS_DIR, "solvency_final.zkey");
  const proofPath = path.join(OUTPUT_DIR, "proof.json");
  const publicPath = path.join(OUTPUT_DIR, "public.json");

  execSync(
    `npx snarkjs groth16 prove ${zkeyPath} ${witnessPath} ${proofPath} ${publicPath}`,
    { stdio: "inherit" }
  );

  // Read generated proof
  const proof: Groth16Proof = JSON.parse(fs.readFileSync(proofPath, "utf-8"));
  const publicSignals: string[] = JSON.parse(fs.readFileSync(publicPath, "utf-8"));

  console.log("\n✅ Proof generated successfully!");
  console.log("   Public signals:", publicSignals);

  // Verify proof locally
  console.log("\n🔍 Verifying proof locally...");
  const vkeyPath = path.join(CIRCUITS_DIR, "verification_key.json");
  
  try {
    execSync(
      `npx snarkjs groth16 verify ${vkeyPath} ${publicPath} ${proofPath}`,
      { stdio: "inherit" }
    );
    console.log("✅ Local verification passed!");
  } catch {
    throw new Error("Local proof verification failed!");
  }

  // Generate Solidity calldata
  console.log("\n📦 Generating Solidity calldata...");
  const calldataOutput = execSync(
    `npx snarkjs zkey export soliditycalldata ${publicPath} ${proofPath}`,
    { encoding: "utf-8" }
  ).trim();

  // Parse calldata by wrapping in array and parsing as JSON
  const parsed = JSON.parse(`[${calldataOutput}]`);
  const calldata = {
    pA: parsed[0] as [string, string],
    pB: parsed[1] as [[string, string], [string, string]],
    pC: parsed[2] as [string, string],
    pubSignals: parsed[3] as string[],
  };

  // Save complete proof result
  const result: ProofResult = {
    proof,
    publicSignals,
    calldata,
  };

  const resultPath = path.join(OUTPUT_DIR, "solvency_proof.json");
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log("\n💾 Complete proof saved to:", resultPath);

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("SOLVENCY PROOF SUMMARY");
  console.log("=".repeat(50));
  console.log(`Epoch ID:          ${epochId}`);
  console.log(`Liabilities Root:  ${liabilitiesRoot.slice(0, 20)}...`);
  console.log(`Reserves Total:    ${reservesTotal} wei`);
  console.log(`Liabilities Total: ${liabilitiesTotal} (private)`);
  console.log(`isSolvent:         ${publicSignals[0] === "1" ? "YES ✅" : "NO ❌"}`);
  console.log("=".repeat(50));

  return result;
}

generateProof()
  .then(() => {
    console.log("\n🎉 Proof generation complete!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
  });
