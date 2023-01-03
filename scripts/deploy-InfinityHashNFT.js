// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {

  const USDPMock = await hre.ethers.getContractFactory("USDPMockTocken");
  const usdpMockDeploy = await USDPMock.deploy(6);
  console.log("USDP Mock Token deployed at " + usdpMockDeploy.address);
  
  const InfinityHashNFT = await hre.ethers.getContractFactory("InfinityHashNFT");
  const infinityHashNFTDeploy = await InfinityHashNFT.deploy("0xe2803E34B6591BCBeB519A36D4C928A2E6b366d8", usdpMockDeploy.address);
  console.log("Infinity Hash NFT deployed at " + infinityHashNFTDeploy.address);

  const InfinityHash = await hre.ethers.getContractFactory("InfinityHash");
  const infinityHashDeploy = await InfinityHash.deploy(infinityHashNFTDeploy.address);
  console.log("Infinity Hash deployed at " + infinityHashDeploy.address);
  

  console.log("Finish deploy")
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
