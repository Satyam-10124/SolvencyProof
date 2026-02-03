import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { hashLeaf, verifyProof, MerkleProof } from "./utils/merkle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const userIdOrFile = process.argv[2];

  if (!userIdOrFile) {
    console.log("Usage: npx tsx src/verify-inclusion.ts <user_id or inclusion_proof.json>");
    console.log("Example: npx tsx src/verify-inclusion.ts alice");
    console.log("Example: npx tsx src/verify-inclusion.ts ../data/output/inclusion_proofs/inclusion_alice.json");
    process.exit(1);
  }

  // Check if it's a user ID or a file path
  let proofPath: string;
  const inclusionProofsDir = path.resolve(__dirname, "../../data/output/inclusion_proofs");
  
  if (userIdOrFile.endsWith(".json")) {
    // It's a file path
    proofPath = path.resolve(__dirname, "..", userIdOrFile);
  } else {
    // It's a user ID - look for the inclusion proof file
    proofPath = path.join(inclusionProofsDir, `inclusion_${userIdOrFile}.json`);
  }

  if (!existsSync(proofPath)) {
    console.error(`❌ Inclusion proof not found for: ${userIdOrFile}`);
    console.error(`   Expected file: ${proofPath}`);
    console.error(`   Run 'npx tsx src/merkle-builder.ts' first to generate proofs.`);
    process.exit(1);
  }

  console.log("🔍 SolvencyProof: Inclusion Verifier\n");

  const proof: MerkleProof = JSON.parse(readFileSync(proofPath, "utf-8"));

  console.log(`User:    ${proof.userId}`);
  console.log(`Balance: ${proof.balance}`);
  console.log(`Root:    ${proof.root}`);
  console.log(`Index:   ${proof.index}`);
  console.log(`Proof:   ${proof.proof.length} siblings\n`);

  // Recompute leaf hash
  const computedLeafHash = hashLeaf(proof.userId, BigInt(proof.balance));
  const leafMatches = computedLeafHash === proof.leafHash;

  console.log(`Leaf hash match: ${leafMatches ? "✅" : "❌"}`);

  if (!leafMatches) {
    console.error("❌ Leaf hash mismatch - data may have been tampered with");
    process.exit(1);
  }

  // Verify Merkle proof
  const isValid = verifyProof(
    proof.leafHash as `0x${string}`,
    proof.proof as `0x${string}`[],
    proof.root as `0x${string}`,
    proof.index
  );

  console.log(`Proof valid:     ${isValid ? "✅" : "❌"}\n`);

  if (isValid) {
    console.log("🎉 Inclusion verified! Your balance is included in the liabilities root.");
  } else {
    console.error("❌ Proof verification failed");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
