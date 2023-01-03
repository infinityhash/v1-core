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
    const ONE_MONTH_IN_SECS = 30 * 24 * 60 * 60 * 3; // 30 days
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

  describe("ERC-1155: configuration", function () {
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

  describe("ERC-1155: mint", function () {
    it("should not mint NFT: not owner", async function () {
      let timelock = await getTimeLock();

      await expect(
        nft.connect(deployer).mint(ethers.utils.parseUnits("1000", decimals))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should not mint NFT: zero price", async function () {
      let timelock = await getTimeLock();

      await expect(
        nft.connect(owner).mint(ethers.utils.parseUnits("0", decimals))
      ).to.be.revertedWithCustomError(nft, "ZeroPrice");
    });

    it("should mint NFT batch 0", async function () {
      let timelock = await getTimeLock();

      await nft.connect(owner).mint(ethers.utils.parseUnits("1000", decimals));

      expect(await nft.exists(0)).to.equal(true);
      expect(await nft.totalSupply(0)).to.equal(10_000);
      expect((await nft.batches(0)).price).to.equal(
        ethers.utils.parseUnits("1000", decimals)
      );
      expect((await nft.batches(0)).timelock).to.be.within(
        timelock - 10,
        timelock + 10
      );
      expect(await nft.sold(0)).to.equal(false);
    });

    it("should not remove last batch: not owner", async function () {
      await expect(nft.connect(deployer).removeLastBatch()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("should mint NFT batch 1", async function () {
      let timelock = await getTimeLock();

      await nft.connect(owner).mint(ethers.utils.parseUnits("2000", decimals));

      expect(await nft.exists(1)).to.equal(true);
      expect(await nft.totalSupply(1)).to.equal(10_000);
      expect((await nft.batches(1)).price).to.equal(
        ethers.utils.parseUnits("2000", decimals)
      );
      expect((await nft.batches(1)).timelock).to.be.within(
        timelock - 10,
        timelock + 10
      );
      expect(await nft.sold(0)).to.equal(false);
    });

    it("should remove batch 1 (no one sold yet)", async function () {
      await nft.connect(owner).removeLastBatch();

      expect(await nft.exists(1)).to.equal(false);
      expect(await nft.totalSupply(1)).to.equal(0);
      expect((await nft.batches(1)).price).to.equal(0);
      expect((await nft.batches(1)).timelock).to.equal(0);
    });

    it("should remove batch 0 (no one sold yet)", async function () {
      await nft.connect(owner).removeLastBatch();

      expect(await nft.exists(0)).to.equal(false);
      expect(await nft.totalSupply(0)).to.equal(0);
      expect((await nft.batches(0)).price).to.equal(0);
      expect((await nft.batches(0)).timelock).to.equal(0);
    });

    it("should not remove last batch: no batches", async function () {
      await expect(
        nft.connect(owner).removeLastBatch()
      ).to.be.revertedWithCustomError(nft, "NoBatches");
    });

    it("should mint NFT batch 0 again", async function () {
      let timelock = await getTimeLock();

      await nft.connect(owner).mint(ethers.utils.parseUnits("1000", decimals));

      expect(await nft.exists(0)).to.equal(true);
      expect(await nft.totalSupply(0)).to.equal(10_000);
      expect((await nft.batches(0)).price).to.equal(
        ethers.utils.parseUnits("1000", decimals)
      );
      expect((await nft.batches(0)).timelock).to.be.within(
        timelock - 10,
        timelock + 10
      );
      expect(await nft.sold(0)).to.equal(false);
    });
  });

  describe("ERC-1155: purchase", function () {
    it("should not purchase NFT: insufficient allowance", async function () {
      await expect(nft.connect(addrs[0]).purchase(0, 1)).to.be.revertedWith(
        "ERC20: insufficient allowance"
      );
    });

    it("should approve stablecoin allowance (address 0)", async function () {
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

    it("should address 0 purchase 1 NFT", async function () {
      await nft.connect(addrs[0]).purchase(0, 1);
      expect(await nft.balanceOf(addrs[0].address, 0)).to.equal(1);
      expect(await nft.sold(0)).to.equal(true);
      expect((await nft.batches(0)).sold).to.equal(1);
      expect(await stable.balanceOf(nft.address)).to.equal(
        ethers.utils.parseUnits(String(1000), decimals)
      );
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
        nft.connect(owner).removeLastBatch()
      ).to.be.revertedWithCustomError(nft, "BatchSold");
    });

    it("should approve stablecoin allowance (addresses 1, 2 and 3)", async function () {
      await stable
        .connect(addrs[1])
        .approve(
          nft.address,
          ethers.utils.parseUnits(String(1_000_000_000), decimals)
        );
      await stable
        .connect(addrs[2])
        .approve(
          nft.address,
          ethers.utils.parseUnits(String(1_000_000_000), decimals)
        );
      await stable
        .connect(addrs[3])
        .approve(
          nft.address,
          ethers.utils.parseUnits(String(1_000_000_000), decimals)
        );
    });

    it("should address 1 purchase 3 NFTs", async function () {
      await nft.connect(addrs[1]).purchase(0, 3);
      expect(await nft.balanceOf(addrs[1].address, 0)).to.equal(3);
      expect(await nft.sold(0)).to.equal(true);
      expect((await nft.batches(0)).sold).to.equal(4);
      expect(await stable.balanceOf(nft.address)).to.equal(
        ethers.utils.parseUnits(String(4000), decimals)
      );
    });

    it("should address 2 purchase 12 NFT", async function () {
      await nft.connect(addrs[2]).purchase(0, 12);
      expect(await nft.balanceOf(addrs[2].address, 0)).to.equal(12);
      expect(await nft.sold(0)).to.equal(true);
      expect((await nft.batches(0)).sold).to.equal(16);
      expect(await stable.balanceOf(nft.address)).to.equal(
        ethers.utils.parseUnits(String(16000), decimals)
      );
    });

    it("should address 3 purchase 27 NFT", async function () {
      await nft.connect(addrs[3]).purchase(0, 27);
      expect(await nft.balanceOf(addrs[3].address, 0)).to.equal(27);
      expect(await nft.sold(0)).to.equal(true);
      expect((await nft.batches(0)).sold).to.equal(43);
      expect(await stable.balanceOf(nft.address)).to.equal(
        ethers.utils.parseUnits(String(43000), decimals)
      );
    });
  });

  describe("ERC-1155: stablecoin transfer", function () {
    it("should not transfer stablecoin: not owner", async function () {
      await expect(
        nft.connect(addrs[0]).erc20Transfer(stable.address, owner.address, 1)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should withdraw stablecoin", async function () {
      let ownerBalance = await stable.balanceOf(owner.address);
      let nftBalance = await stable.balanceOf(nft.address);

      await nft
        .connect(owner)
        .erc20Transfer(stable.address, addrs[9].address, nftBalance);

      expect(await stable.balanceOf(addrs[9].address)).to.equal(
        ownerBalance.add(nftBalance)
      );
    });
  });

  describe("ERC-1155: redeem", function () {
    it("should not redeem NFT: batch not exists", async function () {
      await expect(
        nft.connect(addrs[0]).redeem(1, 1)
      ).to.be.revertedWithCustomError(nft, "BatchNotExists");
    });

    it("should not redeem NFT: zero amount", async function () {
      await expect(
        nft.connect(addrs[0]).redeem(0, 0)
      ).to.be.revertedWithCustomError(nft, "ZeroAmount");
    });

    it("should not redeem NFT: too soon", async function () {
      await expect(
        nft.connect(addrs[0]).redeem(0, 1)
      ).to.be.revertedWithCustomError(nft, "TooSoon");
    });

    it("should advance time: ~89 days", async function () {
      let almost3months = (await time.latest()) + 89 * 24 * 60 * 60;
      await time.increaseTo(almost3months);
    });

    it("should not redeem NFT: too soon (1 day left)", async function () {
      await expect(
        nft.connect(addrs[0]).redeem(0, 1)
      ).to.be.revertedWithCustomError(nft, "TooSoon");
    });

    it("should advance time: 1 day", async function () {
      let oneDay = (await time.latest()) + 1 * 24 * 60 * 60;
      await time.increaseTo(oneDay);
    });

    it("should redeem 1 NFT from address 0", async function () {
      await nft.connect(addrs[0]).redeem(0, 1);

      expect(await nft.totalSupply(0)).to.equal(9999);
      expect(await nft.balanceOf(addrs[0].address, 0)).to.equal(0);
      expect((await nft.batches(0)).redeemed).to.equal(1);
      expect(await token.balanceOf(addrs[0].address)).to.equal(1000);
      expect(await token.totalSupply()).to.equal(1000);
    });

    it("should redeem 2 NFTs from address 1", async function () {
      await nft.connect(addrs[1]).redeem(0, 2);

      expect(await nft.totalSupply(0)).to.equal(9997);
      expect(await nft.balanceOf(addrs[1].address, 0)).to.equal(1);
      expect((await nft.batches(0)).redeemed).to.equal(3);
      expect(await token.balanceOf(addrs[1].address)).to.equal(2000);
      expect(await token.totalSupply()).to.equal(3000);
    });

    it("should redeem 9 NFTs from address 2", async function () {
      await nft.connect(addrs[2]).redeem(0, 9);

      expect(await nft.totalSupply(0)).to.equal(9988);
      expect(await nft.balanceOf(addrs[2].address, 0)).to.equal(3);
      expect((await nft.batches(0)).redeemed).to.equal(12);
      expect(await token.balanceOf(addrs[2].address)).to.equal(9000);
      expect(await token.totalSupply()).to.equal(12000);
    });

    it("should redeem 15 NFTs from address 3", async function () {
      await nft.connect(addrs[3]).redeem(0, 15);

      expect(await nft.totalSupply(0)).to.equal(9973);
      expect(await nft.balanceOf(addrs[3].address, 0)).to.equal(12);
      expect((await nft.batches(0)).redeemed).to.equal(27);
      expect(await token.balanceOf(addrs[3].address)).to.equal(15000);
      expect(await token.totalSupply()).to.equal(27000);
    });
  });

  describe("New batch after six months", function () {
    it("should advance time: ~6 months", async function () {
      let almost6months = (await time.latest()) + 6 * 30 * 24 * 60 * 60;
      await time.increaseTo(almost6months);
    });

    it("should create new batch", async function () {
      let timelock = await getTimeLock();

      await nft.connect(owner).mint(ethers.utils.parseUnits("2500", decimals));

      expect(await nft.exists(1)).to.equal(true);
      expect(await nft.totalSupply(1)).to.equal(10_000);
      expect((await nft.batches(1)).price).to.equal(
        ethers.utils.parseUnits("2500", decimals)
      );
      expect((await nft.batches(1)).timelock).to.be.within(
        timelock - 10,
        timelock + 10
      );
      expect(await nft.sold(1)).to.equal(false);
    });

    it("should address 1 purchase 13 NFTs from batch 1", async function () {
      let address = 1;
      let amount = 13;
      let batch = 1;

      await nft.connect(addrs[address]).purchase(batch, amount);

      expect(await nft.balanceOf(addrs[address].address, batch)).to.equal(
        amount
      );
      expect(await nft.sold(batch)).to.equal(true);
      expect((await nft.batches(batch)).sold).to.equal(amount);
      expect(await stable.balanceOf(nft.address)).to.equal(
        ethers.utils.parseUnits(String(2500 * amount), decimals)
      );
    });

    it("should address 2 purchase 6 NFTs from batch 1", async function () {
      let address = 2;
      let amount = 6;
      let batch = 1;

      let contractStableBalance = await stable.balanceOf(nft.address);
      let sold = (await nft.batches(batch)).sold;

      await nft.connect(addrs[address]).purchase(batch, amount);

      expect(await nft.balanceOf(addrs[address].address, batch)).to.equal(
        amount
      );
      expect(await nft.sold(batch)).to.equal(true);
      expect((await nft.batches(batch)).sold).to.equal(
        sold.add(String(amount))
      );
      expect(await stable.balanceOf(nft.address)).to.equal(
        contractStableBalance.add(
          ethers.utils.parseUnits(String(2500 * amount), decimals)
        )
      );
    });

    it("should address 3 purchase 6 NFTs from batch 1", async function () {
        let address = 3;
        let amount = 11;
        let batch = 1;
  
        let contractStableBalance = await stable.balanceOf(nft.address);
        let sold = (await nft.batches(batch)).sold;
  
        await nft.connect(addrs[address]).purchase(batch, amount);
  
        expect(await nft.balanceOf(addrs[address].address, batch)).to.equal(
          amount
        );
        expect(await nft.sold(batch)).to.equal(true);
        expect((await nft.batches(batch)).sold).to.equal(
          sold.add(String(amount))
        );
        expect(await stable.balanceOf(nft.address)).to.equal(
          contractStableBalance.add(
            ethers.utils.parseUnits(String(2500 * amount), decimals)
          )
        );
      });    
  });

  describe("ERC-20: mint", function () {
    it("should not mint: deployer not minter", async function () {
      await expect(
        token.connect(deployer).mint(addrs[0].address, 1)
      ).to.be.revertedWithCustomError(token, "NotMinter");
    });

    it("should not mint: nft contract owner not minter", async function () {
      await expect(
        token.connect(owner).mint(addrs[0].address, 1)
      ).to.be.revertedWithCustomError(token, "NotMinter");
    });
  });

  describe("Interface", function () {
    it("should return interface ID", async function () {
      expect(await nft.supportsInterface("0x01ffc9a7")).to.equal(true);
    });
  });
});
