import { ethers } from "hardhat";

async function main() {
  const platformFeeBps = 500; // 5% platform fee

  const EasyWalksMarketplace = await ethers.getContractFactory("EasyWalksMarketplace");
  const marketplace = await EasyWalksMarketplace.deploy(platformFeeBps);
  await marketplace.waitForDeployment();

  const address = await marketplace.getAddress();
  console.log(`EasyWalksMarketplace deployed to: ${address}`);
  console.log(`Platform fee: ${platformFeeBps / 100}%`);
  console.log(`Owner: ${(await ethers.getSigners())[0].address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
