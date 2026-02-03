import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy real Groth16Verifier for ZK proof verification
  const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
  const verifier = await Groth16Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("Groth16Verifier deployed to:", verifierAddress);

  // Deploy SolvencyProofRegistry
  const SolvencyProofRegistry = await ethers.getContractFactory("SolvencyProofRegistry");
  const registry = await SolvencyProofRegistry.deploy(verifierAddress);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("SolvencyProofRegistry deployed to:", registryAddress);

  // Save deployment addresses
  const deployment = {
    network: "sepolia",
    chainId: 11155111,
    timestamp: new Date().toISOString(),
    contracts: {
      Groth16Verifier: verifierAddress,
      SolvencyProofRegistry: registryAddress,
    },
  };

  const outputPath = path.join(__dirname, "../../data/output/deployment.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deployment, null, 2));
  console.log("\nDeployment saved to:", outputPath);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
