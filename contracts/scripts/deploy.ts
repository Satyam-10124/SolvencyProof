import { ethers } from "hardhat";

async function main() {
  const Placeholder = await ethers.getContractFactory("Placeholder");
  const placeholder = await Placeholder.deploy();

  await placeholder.waitForDeployment();

  const address = await placeholder.getAddress();
  console.log("Placeholder deployed to:", address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
