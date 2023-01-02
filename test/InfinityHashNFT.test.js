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
  async function getTimeLock() {
    const ONE_MONTH_IN_SECS = 30 * 24 * 60 * 60; // 30 days
    const unlockTime = (await time.latest()) + ONE_MONTH_IN_SECS;

    return unlockTime;
  }

  before(async function () {
    [deployer, owner, ...addrs] = await ethers.getSigners();

    console.log("Deployer address: ", deployer.address);
    console.log("Owner address: ", owner.address);

    stable = await deploy("USDPMockTocken", 6);
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

    // Mint stablecoins to users
    decimals = String(await stable.decimals());

    stable.mint(addrs[0].address, ethers.utils.parseUnits("100000", decimals));
    stable.mint(addrs[1].address, ethers.utils.parseUnits("100000", decimals));
    stable.mint(addrs[2].address, ethers.utils.parseUnits("100000", decimals));
    stable.mint(addrs[3].address, ethers.utils.parseUnits("100000", decimals));
    stable.mint(addrs[4].address, ethers.utils.parseUnits("100000", decimals));
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

    it("should set URI", async function () {
      await nft.connect(owner).setURI("https://ipfs.io/ipfs/");
    });

    it("should not set URI: not owner", async function () {
      await expect(
        nft.connect(deployer).setURI("https://scam.com.br/ipfs/")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("NFT", function () {
    it("should not mint NFT: not owner", async function () {
      let timelock = await getTimeLock();

      await expect(
        nft
          .connect(deployer)
          .mint(0, 1000, timelock, ethers.utils.parseUnits("1000", decimals))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should not mint NFT: zero price", async function () {
      let timelock = await getTimeLock();

      await expect(
        nft
          .connect(owner)
          .mint(0, 1000, timelock, ethers.utils.parseUnits("0", decimals))
      ).to.be.revertedWithCustomError(nft, "ZeroPrice");
    });

    it("should not mint NFT: zero supply", async function () {
      let timelock = await getTimeLock();

      await expect(
        nft
          .connect(owner)
          .mint(0, 0, timelock, ethers.utils.parseUnits("1000", decimals))
      ).to.be.revertedWithCustomError(nft, "ZeroSupply");
    });

    it("should mint NFT batch 0", async function () {
      let timelock = await getTimeLock();

      await nft
        .connect(owner)
        .mint(0, 10_000, timelock, ethers.utils.parseUnits("1000", decimals));

      expect(await nft.exists(0)).to.equal(true);
      expect(await nft.totalSupply(0)).to.equal(10_000);
      expect((await nft.batches(0)).price).to.equal(
        ethers.utils.parseUnits("1000", decimals)
      );
      expect((await nft.batches(0)).timelock).to.equal(timelock);
    });

    it("should not mint NFT batch 0 again: batch exists", async function () {
      let timelock = await getTimeLock();

      await expect(
        nft
          .connect(owner)
          .mint(0, 10_000, timelock, ethers.utils.parseUnits("1000", decimals))
      ).to.be.revertedWithCustomError(nft, "BatchExists");
    });

    it("should not purchase NFT: insufficient allowance", async function () {
      await expect(nft.connect(addrs[0]).purchase(0, 1)).to.be.revertedWith(
        "ERC20: insufficient allowance"
      );
    });

    it("should not purchase NFT: insufficient allowance", async function () {
      await stable
        .connect(addrs[0])
        .approve(
          nft.address,
          ethers.utils.parseUnits(String(100_000), decimals)
        );

      await expect(nft.connect(addrs[0]).purchase(0, 1)).to.be.revertedWith(
        "ERC20: insufficient allowance"
      );
    });
  });
});
