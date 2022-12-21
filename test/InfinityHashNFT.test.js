const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

async function deploy(name, ...params) {
  const Contract = await ethers.getContractFactory(name);
  return await Contract.deploy(...params).then((f) => f.deployed());
}

describe("Store", function () {
  before(async function () {
    [deployer, owner, ...addrs] = await ethers.getSigners();

    console.log("Deployer address: ", deployer.address);
    console.log("Owner address: ", owner.address);

    stable = await deploy("USDPMockTocken");
    console.log("USDP deployed to", stable.address);

    token = await deploy("InfinityHashToken", owner.address);
    console.log("InfinityHashToken deployed to", token.address);

    nft = await deploy(
      "InfinityHashNFT",
      owner.address,
      stable.address,
      token.address
    );
    console.log("InfinityHashNFT deployed to", nft.address, "\n");
  });

  describe("Deployment", function () {
    it("should check Token owner address", async function () {
      expect(await token.owner()).to.equal(owner.address);
    });

    it("should check NFT owner address", async function () {
      expect(await nft.owner()).to.equal(owner.address);
    });

    it("should check stablecoin name and symbol", async function () {
      expect(await stable.name()).to.equal("USDP Mock Tocken");
      expect(await stable.symbol()).to.equal("USDP");
    });

    it("should check token name and symbol", async function () {
      expect(await token.name()).to.equal("InfinityHash Token");
      expect(await token.symbol()).to.equal("INFH");
    });

    it("should not set NFT contract address: not owner", async function () {
      await expect(
        token.connect(deployer).setNftContract(nft.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should set NFT contract address", async function () {
      await token.connect(owner).setNftContract(nft.address);
      expect(await token.nftContract()).to.equal(nft.address);
    });

    it("should not set NFT contract address: already set", async function () {
      await expect(
        token.connect(owner).setNftContract(nft.address)
      ).to.be.revertedWithCustomError(token, "NftContractAlreadySet");
    });
  });
});
