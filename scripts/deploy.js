const hre = require("hardhat");
var clc = require("cli-color");

async function main() {
  console.log(clc.bold("\nInfinity Hash"));
  console.log("Network:", clc.yellow(hre.network.name), "\n");

  if (hre.network.name == "goerli" || hre.network.name == "hardhat") {
    if (hre.network.name == "hardhat") {
      console.log(clc.red.inverse("HARDHAT LOCAL NETWORK\n"));
    }

    if (hre.network.name == "goerli") {
      console.log(clc.red.inverse("GOERLI TESTNET\n"));
    }

    // Stablecoin mock token
    const USDPMock = await hre.ethers.getContractFactory("USDPMockTocken");
    const usdpMock = await USDPMock.deploy(6);
    await usdpMock.deployed();
    console.log("USDP Mock Token deployed at " + clc.yellow(usdpMock.address));

    contractOwner = process.env.GOERLI_OWNER_ACCOUNT;
    stablecoinAddress = usdpMock.address;
  }

  if (hre.network.name == "ethereum") {
    contractOwner = process.env.ETHEREUM_OWNER_ACCOUNT;
    stablecoinAddress = process.env.ETHEREUM_STABLECOIN_ADDRESS;
  }

  // Infinity Hash NFT (ERC-1155)
  const InfinityHashNFT = await hre.ethers.getContractFactory(
    "InfinityHashNFT"
  );
  const infinityHashNFT = await InfinityHashNFT.deploy(
    contractOwner,
    stablecoinAddress
  );
  await infinityHashNFT.deployed();
  console.log(
    "InfinityHashNFT deployed at " + clc.yellow(infinityHashNFT.address)
  );

  // Infinity Hash Token (ERC-20)
  const InfinityHash = await hre.ethers.getContractFactory("InfinityHash");
  const infinityHash = await InfinityHash.deploy(infinityHashNFT.address);
  await infinityHash.deployed();
  console.log(
    "InfinityHash Token deployed at " + clc.yellow(infinityHash.address, "\n")
  );

  // Warning
  console.warn(
    clc.inverse.red("WARNING:"),
    "Owner MUST call",
    clc.inverse.bold.yellow(
      "InfinityHashNFT.setTokenContract(" + infinityHash.address + ")"
    )
  );

  // Contracts verification
  if (hre.network.name == "goerli" || hre.network.name == "ethereum") {
    console.log("\nVerifying contracts on Etherscan...\n");

    if (hre.network.name == "goerli") {
      try {
        await hre.run("verify:verify", {
          address: stablecoinAddress,
          contract: "contracts/tests/ERC20Mock.sol:USDPMockTocken",
          constructorArguments: [6],
        });
      } catch (error) {
        console.log("Mock Token verification failed:", error.message);
      }
    }

    try {
      await hre.run("verify:verify", {
        address: infinityHashNFT.address,
        contract: "contracts/InfinityHashNFT.sol:InfinityHashNFT",
        constructorArguments: [contractOwner, stablecoinAddress],
      });
    } catch (error) {
      console.log("InfinityHashNFT verification failed:", error.message);
    }

    try {
      await hre.run("verify:verify", {
        address: infinityHash.address,
        contract: "contracts/InfinityHash.sol:InfinityHash",
        constructorArguments: [infinityHashNFT.address],
      });
    } catch (error) {
      console.log("InfinityHash Token verification failed:", error.message);
    }
  }

  console.log(clc.blue("\nDeploy Finished\n"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
