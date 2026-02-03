import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy MockVerifier first (for testing - replace with real verifier in production)
  const MockVerifier = await ethers.getContractFactory("MockVerifier");
  const mockVerifier = await MockVerifier.deploy(true); // alwaysValid = true for demo
  await mockVerifier.waitForDeployment();
  const verifierAddress = await mockVerifier.getAddress();
  console.log("MockVerifier deployed to:", verifierAddress);

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
      MockVerifier: verifierAddress,
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
