const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔐 Generating ZK solvency proof...\n");

  // Read input data
  const outputDir = path.join(__dirname, "../../data/output");
  
  const liabilitiesRoot = JSON.parse(
    fs.readFileSync(path.join(outputDir, "liabilities_root.json"), "utf-8")
  );
  
  const liabilitiesTotal = JSON.parse(
    fs.readFileSync(path.join(outputDir, "liabilities_total.json"), "utf-8")
  );
  
  const reservesSnapshot = JSON.parse(
    fs.readFileSync(path.join(outputDir, "reserves_snapshot.json"), "utf-8")
  );

  // Convert hex root to bigint
  const rootBigInt = BigInt(liabilitiesRoot.liabilities_root);
  
  // Convert epoch_id to bigint (hash it)
  const epochHash = BigInt("0x" + Buffer.from(liabilitiesRoot.epoch_id).toString("hex").padEnd(64, "0"));
  
  // Reserves in wei
  const reservesWei = BigInt(reservesSnapshot.reserves_total_wei);
  
  // Liabilities total
  const liabilitiesTotalBigInt = BigInt(liabilitiesTotal.liabilities_total);

  console.log("📊 Input values:");
  console.log(`   Liabilities Root: ${liabilitiesRoot.liabilities_root}`);
  console.log(`   Liabilities Total: ${liabilitiesTotal.liabilities_total}`);
  console.log(`   Reserves Total: ${reservesSnapshot.reserves_total_wei} wei`);
  console.log(`   Epoch ID: ${liabilitiesRoot.epoch_id}\n`);

  // Check solvency condition
  if (reservesWei < liabilitiesTotalBigInt) {
    console.error("❌ Cannot generate proof: reserves < liabilities (not solvent)");
    process.exit(1);
  }

  console.log("✅ Solvency condition met: reserves >= liabilities\n");

  // Prepare circuit inputs
  const input = {
    liabilitiesRoot: rootBigInt.toString(),
    reservesTotal: reservesWei.toString(),
    epochId: epochHash.toString(),
    liabilitiesTotal: liabilitiesTotalBigInt.toString(),
  };

  console.log("🔄 Generating proof...");

  const wasmPath = path.join(__dirname, "../build/solvency_js/solvency.wasm");
  const zkeyPath = path.join(__dirname, "../build/solvency_final.zkey");

  if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
    console.error("❌ Circuit not compiled. Run: cd circuits && npm run setup");
    process.exit(1);
  }

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath
  );

  console.log("✅ Proof generated!\n");

  // Save proof
  const proofOutput = {
    proof,
    publicSignals,
    epoch_id: liabilitiesRoot.epoch_id,
    timestamp: Date.now(),
  };

  fs.writeFileSync(
    path.join(outputDir, "proof.json"),
    JSON.stringify(proofOutput, null, 2)
  );
  console.log("💾 Saved proof.json");

  // Also save in format ready for contract
  const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  fs.writeFileSync(
    path.join(outputDir, "proof_calldata.txt"),
    calldata
  );
  console.log("💾 Saved proof_calldata.txt (for contract submission)\n");

  console.log("🎉 ZK proof generation complete!");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
