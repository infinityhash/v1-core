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

describe("Infinity Hash Project", function () {
  async function getTimeLock() {
    const ONE_MONTH_IN_SECS = 30 * 24 * 60 * 60; // 30 days
    const unlockTime = (await time.latest()) + ONE_MONTH_IN_SECS;

    return unlockTime;
  }

  before(async function () {
    [deployer, owner, ...addrs] = await ethers.getSigners();

    console.log("Deployer address: ", deployer.address);
    console.log("Owner address: ", owner.address);

    // USDP stablecoin mock token
    stable = await deploy("USDPMockTocken", 6);
    console.log("USDP deployed to", stable.address);

    // InfinityHash NFT
    nft = await deploy("InfinityHashNFT", owner.address, stable.address);
    console.log("InfinityHashNFT deployed to", nft.address, "\n");

    // InfinityHash token
    token = await deploy("InfinityHash", nft.address);
    console.log("InfinityHashToken deployed to", token.address);

    // Mint stablecoins to users
    decimals = String(await stable.decimals());

    stable.mint(
      addrs[0].address,
      ethers.utils.parseUnits("1000000000", decimals)
    );
    stable.mint(
      addrs[1].address,
      ethers.utils.parseUnits("1000000000", decimals)
    );
    stable.mint(
      addrs[2].address,
      ethers.utils.parseUnits("1000000000", decimals)
    );
    stable.mint(
      addrs[3].address,
      ethers.utils.parseUnits("1000000000", decimals)
    );
    stable.mint(
      addrs[4].address,
      ethers.utils.parseUnits("1000000000", decimals)
    );
  });

  describe("Deployment", function () {
    it("should check NFT owner address", async function () {
      expect(await nft.owner()).to.equal(owner.address);
    });

    it("should check token name and symbol", async function () {
      expect(await token.name()).to.equal("Infinity Hash");
      expect(await token.symbol()).to.equal("IFH");
    });

    it("should check MOCK stablecoin name and symbol", async function () {
      expect(await stable.name()).to.equal("USDP Mock Tocken");
      expect(await stable.symbol()).to.equal("USDP");
    });
  });

  describe("ERC-1155 configuration", function () {
    it("should not set URI: not owner", async function () {
      await expect(
        nft.connect(deployer).setURI("https://scam.com.br/ipfs/")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should set URI", async function () {
      await nft.connect(owner).setURI("https://ipfs.io/ipfs/");
    });

    it("should not set token contract address: not owner", async function () {
      await expect(
        nft.connect(deployer).setTokenContract(token.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should not set token contract address: zero address", async function () {
      await expect(
        nft.connect(owner).setTokenContract(ethers.constants.AddressZero)
      ).to.be.revertedWithCustomError(nft, "ZeroAddress");
    });

    it("should set token contract address", async function () {
      await nft.connect(owner).setTokenContract(token.address);
      expect(await nft.token()).to.equal(token.address);
    });

    it("should not set token contract address: already set", async function () {
      await expect(
        nft.connect(owner).setTokenContract(stable.address)
      ).to.be.revertedWithCustomError(nft, "TokenAlreadySet");
    });
  });

  describe("NFT: mint", function () {
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
      expect(await nft.sold(0)).to.equal(false);
    });

    it("should not mint NFT batch 0 again: batch exists", async function () {
      let timelock = await getTimeLock();

      await expect(
        nft
          .connect(owner)
          .mint(0, 10_000, timelock, ethers.utils.parseUnits("1000", decimals))
      ).to.be.revertedWithCustomError(nft, "BatchExists");
    });

    it("should not remove batch 0: not owner", async function () {
      await expect(nft.connect(deployer).removeBatch(0)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("should not remove batch 1: not exists", async function () {
      await expect(
        nft.connect(owner).removeBatch(1)
      ).to.be.revertedWithCustomError(nft, "BatchNotExists");
    });

    it("should mint NFT batch 1", async function () {
      let timelock = await getTimeLock();

      await nft
        .connect(owner)
        .mint(1, 10_000, timelock, ethers.utils.parseUnits("2000", decimals));

      expect(await nft.exists(1)).to.equal(true);
      expect(await nft.totalSupply(1)).to.equal(10_000);
      expect((await nft.batches(1)).price).to.equal(
        ethers.utils.parseUnits("2000", decimals)
      );
      expect((await nft.batches(1)).timelock).to.equal(timelock);
    });

    it("should remove batch 1 (no one sold yet)", async function () {
      await nft.connect(owner).removeBatch(1);

      expect(await nft.exists(1)).to.equal(false);
      expect(await nft.totalSupply(1)).to.equal(0);
      expect((await nft.batches(1)).price).to.equal(0);
      expect((await nft.batches(1)).timelock).to.equal(0);
    });
  });

  describe("NFT: purchase", function () {
    it("should not purchase NFT: insufficient allowance", async function () {
      await expect(nft.connect(addrs[0]).purchase(0, 1)).to.be.revertedWith(
        "ERC20: insufficient allowance"
      );
    });

    it("should approve stablecoin allowance", async function () {
      await stable
        .connect(addrs[0])
        .approve(
          nft.address,
          ethers.utils.parseUnits(String(1_000_000_000), decimals)
        );

      expect(await stable.allowance(addrs[0].address, nft.address)).to.equal(
        ethers.utils.parseUnits(String(1_000_000_000), decimals)
      );
    });

    it("should not purchase NFT: zero amount", async function () {
      await expect(
        nft.connect(addrs[0]).purchase(0, 0)
      ).to.be.revertedWithCustomError(nft, "ZeroAmount");
    });

    it("should purchase NFT", async function () {
      await nft.connect(addrs[0]).purchase(0, 1);
      expect(await nft.balanceOf(addrs[0].address, 0)).to.equal(1);
      expect(await nft.sold(0)).to.equal(true);
    });

    it("should not purchase NFT: insufficiente NFT balance for transfer", async function () {
      await expect(
        nft.connect(addrs[0]).purchase(0, 10_000)
      ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
    });

    it("should not purchase NFT: batch 1 not exists", async function () {
      await expect(
        nft.connect(addrs[0]).purchase(1, 1)
      ).to.be.revertedWithCustomError(nft, "BatchNotExists");
    });

    it("should not remove batch 0: already sold one NFT", async function () {
      await expect(
        nft.connect(owner).removeBatch(0)
      ).to.be.revertedWithCustomError(nft, "BatchSold");
    });
  });
});
