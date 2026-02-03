import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { parse } from "csv-parse/sync";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildMerkleTree,
  generateProof,
  MerkleProof,
} from "./utils/merkle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const OUTPUT_DIR = path.resolve(__dirname, "../../data/output");

interface LiabilityRow {
  user_id: string;
  balance: string;
}

async function main() {
  console.log("📦 SolvencyProof: Liabilities Merkle Builder\n");

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Read liabilities CSV
  const csvPath = path.join(DATA_DIR, "liabilities.csv");
  if (!existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    process.exit(1);
  }

  const csvContent = readFileSync(csvPath, "utf-8");
  const rows: LiabilityRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`📄 Loaded ${rows.length} liability entries from CSV\n`);

  // Convert to bigint entries
  const entries = rows.map((row) => ({
    userId: row.user_id,
    balance: BigInt(row.balance),
  }));

  // Build Merkle tree
  const tree = buildMerkleTree(entries);

  console.log(`🌳 Merkle Tree Built`);
  console.log(`   Root:  ${tree.root}`);
  console.log(`   Total: ${tree.total.toString()}`);
  console.log(`   Leaves: ${tree.leaves.length}\n`);

  // Read epoch
  const epochPath = path.join(DATA_DIR, "epoch.json");
  let epochData = { epoch_id: "epoch_001", timestamp: Date.now() };
  if (existsSync(epochPath)) {
    epochData = JSON.parse(readFileSync(epochPath, "utf-8"));
  }

  // Save liabilities root
  const rootOutput = {
    liabilities_root: tree.root,
    epoch_id: epochData.epoch_id,
    timestamp: epochData.timestamp,
    leaf_count: tree.leaves.length,
  };
  writeFileSync(
    path.join(OUTPUT_DIR, "liabilities_root.json"),
    JSON.stringify(rootOutput, null, 2)
  );
  console.log(`✅ Saved liabilities_root.json`);

  // Save liabilities total (private, for proof generation)
  const totalOutput = {
    liabilities_total: tree.total.toString(),
    epoch_id: epochData.epoch_id,
  };
  writeFileSync(
    path.join(OUTPUT_DIR, "liabilities_total.json"),
    JSON.stringify(totalOutput, null, 2)
  );
  console.log(`✅ Saved liabilities_total.json (private)`);

  // Generate and save per-user inclusion proofs
  const proofsDir = path.join(OUTPUT_DIR, "inclusion_proofs");
  if (!existsSync(proofsDir)) {
    mkdirSync(proofsDir, { recursive: true });
  }

  for (const leaf of tree.leaves) {
    const proof = generateProof(tree, leaf.index);
    const inclusionProof: MerkleProof = {
      userId: leaf.userId,
      balance: leaf.balance.toString(),
      leafHash: leaf.hash,
      proof,
      index: leaf.index,
      root: tree.root,
    };

    const proofPath = path.join(proofsDir, `inclusion_${leaf.userId}.json`);
    writeFileSync(proofPath, JSON.stringify(inclusionProof, null, 2));
  }
  console.log(`✅ Saved ${tree.leaves.length} inclusion proof files\n`);

  console.log("🎉 Liabilities Merkle build complete!");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
