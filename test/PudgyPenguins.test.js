const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * PudgyPenguins合约单元测试
 */

describe("PudgyPenguins NFT 合约测试", function () {
  let pudgyPenguins;
  let owner;
  let addr1;
  let addr2;
  const baseURI = "https://test.com/";
  const PRICE = ethers.parseEther("0.03");
  const MAX_ELEMENTS = 8888;
  const MAX_BY_MINT = 20;

  beforeEach(async function () {
    // 获取测试账户
    [owner, addr1, addr2] = await ethers.getSigners();

    // 部署合约
    const PudgyPenguins = await ethers.getContractFactory("PudgyPenguins");
    pudgyPenguins = await PudgyPenguins.deploy(baseURI);
    await pudgyPenguins.waitForDeployment();
  });

  describe("部署测试", function () {
    it("应该正确设置合约名称和符号", async function () {
      expect(await pudgyPenguins.name()).to.equal("PudgyPenguins");
      expect(await pudgyPenguins.symbol()).to.equal("PPG");
    });

    it("应该正确设置baseURI", async function () {
      expect(await pudgyPenguins.baseTokenURI()).to.equal(baseURI);
    });

    it("应该正确设置所有者", async function () {
      expect(await pudgyPenguins.owner()).to.equal(owner.address);
    });

    it("应该默认处于暂停状态", async function () {
      expect(await pudgyPenguins.paused()).to.equal(true);
    });

    it("应该正确设置常量", async function () {
      expect(await pudgyPenguins.MAX_ELEMENTS()).to.equal(MAX_ELEMENTS);
      expect(await pudgyPenguins.PRICE()).to.equal(PRICE);
      expect(await pudgyPenguins.MAX_BY_MINT()).to.equal(MAX_BY_MINT);
    });
  });

  describe("暂停功能测试", function () {
    it("所有者应该能够取消暂停", async function () {
      await pudgyPenguins.pause(false);
      expect(await pudgyPenguins.paused()).to.equal(false);
    });

    it("所有者应该能够暂停", async function () {
      await pudgyPenguins.pause(false);
      await pudgyPenguins.pause(true);
      expect(await pudgyPenguins.paused()).to.equal(true);
    });

    it("非所有者不能暂停/取消暂停", async function () {
      await expect(
        pudgyPenguins.connect(addr1).pause(false)
      ).to.be.reverted;
    });
  });

  describe("Mint功能测试", function () {
    beforeEach(async function () {
      // 取消暂停以便测试mint
      await pudgyPenguins.pause(false);
    });

    it("应该能够mint单个NFT", async function () {
      const mintPrice = await pudgyPenguins.price(1);
      await pudgyPenguins.mint(addr1.address, 1, { value: mintPrice });
      
      expect(await pudgyPenguins.balanceOf(addr1.address)).to.equal(1);
      expect(await pudgyPenguins.totalMint()).to.equal(1);
    });

    it("应该能够mint多个NFT", async function () {
      const count = 5;
      const mintPrice = await pudgyPenguins.price(count);
      await pudgyPenguins.mint(addr1.address, count, { value: mintPrice });
      
      expect(await pudgyPenguins.balanceOf(addr1.address)).to.equal(count);
      expect(await pudgyPenguins.totalMint()).to.equal(count);
    });

    it("应该能够mint最大数量", async function () {
      const mintPrice = await pudgyPenguins.price(MAX_BY_MINT);
      await pudgyPenguins.mint(addr1.address, MAX_BY_MINT, { value: mintPrice });
      
      expect(await pudgyPenguins.balanceOf(addr1.address)).to.equal(MAX_BY_MINT);
    });

    it("超过单次最大mint数量应该失败", async function () {
      const count = MAX_BY_MINT + 1;
      const mintPrice = await pudgyPenguins.price(count);
      
      await expect(
        pudgyPenguins.mint(addr1.address, count, { value: mintPrice })
      ).to.be.revertedWith("Exceeds number");
    });

    it("支付金额不足应该失败", async function () {
      const mintPrice = await pudgyPenguins.price(1);
      const insufficientAmount = mintPrice - BigInt(1);
      
      await expect(
        pudgyPenguins.mint(addr1.address, 1, { value: insufficientAmount })
      ).to.be.revertedWith("Value below price");
    });

    it("暂停状态下非所有者不能mint", async function () {
      await pudgyPenguins.pause(true);
      const mintPrice = await pudgyPenguins.price(1);
      
      await expect(
        pudgyPenguins.connect(addr1).mint(addr1.address, 1, { value: mintPrice })
      ).to.be.revertedWith("Pausable: paused");
    });

    it("暂停状态下所有者可以mint", async function () {
      await pudgyPenguins.pause(true);
      const mintPrice = await pudgyPenguins.price(1);
      
      await pudgyPenguins.mint(owner.address, 1, { value: mintPrice });
      expect(await pudgyPenguins.balanceOf(owner.address)).to.equal(1);
    });

    it("应该正确计算价格", async function () {
      expect(await pudgyPenguins.price(1)).to.equal(PRICE);
      expect(await pudgyPenguins.price(5)).to.equal(PRICE * BigInt(5));
      expect(await pudgyPenguins.price(10)).to.equal(PRICE * BigInt(10));
    });

    it("应该触发CreatePenguin事件", async function () {
      const mintPrice = await pudgyPenguins.price(1);
      
      await expect(pudgyPenguins.mint(addr1.address, 1, { value: mintPrice }))
        .to.emit(pudgyPenguins, "CreatePenguin")
        .withArgs(0);
    });
  });

  describe("Token查询功能测试", function () {
    beforeEach(async function () {
      await pudgyPenguins.pause(false);
      const mintPrice = await pudgyPenguins.price(3);
      await pudgyPenguins.mint(addr1.address, 3, { value: mintPrice });
    });

    it("应该能够查询钱包拥有的tokens", async function () {
      const tokens = await pudgyPenguins.walletOfOwner(addr1.address);
      expect(tokens.length).to.equal(3);
      expect(tokens[0]).to.equal(0);
      expect(tokens[1]).to.equal(1);
      expect(tokens[2]).to.equal(2);
    });

    it("应该能够通过索引查询token", async function () {
      const tokenId = await pudgyPenguins.tokenOfOwnerByIndex(addr1.address, 0);
      expect(tokenId).to.equal(0);
    });

    it("应该能够查询总供应量", async function () {
      expect(await pudgyPenguins.totalSupply()).to.equal(3);
      expect(await pudgyPenguins.totalMint()).to.equal(3);
    });
  });

  describe("Token转移测试", function () {
    beforeEach(async function () {
      await pudgyPenguins.pause(false);
      const mintPrice = await pudgyPenguins.price(1);
      await pudgyPenguins.mint(addr1.address, 1, { value: mintPrice });
    });

    it("所有者应该能够转移token", async function () {
      await pudgyPenguins.connect(addr1).transferFrom(addr1.address, addr2.address, 0);
      expect(await pudgyPenguins.ownerOf(0)).to.equal(addr2.address);
    });

    it("暂停状态下非合约所有者不能转移token", async function () {
      await pudgyPenguins.pause(true);
      
      await expect(
        pudgyPenguins.connect(addr1).transferFrom(addr1.address, addr2.address, 0)
      ).to.be.revertedWith("ERC721Pausable: token transfer while paused");
    });

    it("暂停状态下合约所有者可以转移token", async function () {
      // 先把token转给owner
      await pudgyPenguins.connect(addr1).transferFrom(addr1.address, owner.address, 0);
      
      // 暂停
      await pudgyPenguins.pause(true);
      
      // owner应该能够转移
      await pudgyPenguins.transferFrom(owner.address, addr2.address, 0);
      expect(await pudgyPenguins.ownerOf(0)).to.equal(addr2.address);
    });
  });

  describe("销毁功能测试", function () {
    beforeEach(async function () {
      await pudgyPenguins.pause(false);
      const mintPrice = await pudgyPenguins.price(1);
      await pudgyPenguins.mint(addr1.address, 1, { value: mintPrice });
    });

    it("token所有者应该能够销毁token", async function () {
      await pudgyPenguins.connect(addr1).burn(0);
      expect(await pudgyPenguins.balanceOf(addr1.address)).to.equal(0);
    });

    it("非token所有者不能销毁token", async function () {
      await expect(
        pudgyPenguins.connect(addr2).burn(0)
      ).to.be.reverted;
    });
  });

  describe("BaseURI设置测试", function () {
    it("所有者应该能够设置baseURI", async function () {
      const newURI = "https://newuri.com/";
      await pudgyPenguins.setBaseURI(newURI);
      expect(await pudgyPenguins.baseTokenURI()).to.equal(newURI);
    });

    it("非所有者不能设置baseURI", async function () {
      await expect(
        pudgyPenguins.connect(addr1).setBaseURI("https://test.com/")
      ).to.be.reverted;
    });
  });

  describe("提现功能测试", function () {
    beforeEach(async function () {
      await pudgyPenguins.pause(false);
      const mintPrice = await pudgyPenguins.price(10);
      await pudgyPenguins.mint(addr1.address, 10, { value: mintPrice });
    });

    it("合约应该收到mint支付", async function () {
      const balance = await ethers.provider.getBalance(await pudgyPenguins.getAddress());
      expect(balance).to.equal(PRICE * BigInt(10));
    });

    it("所有者应该能够提现", async function () {
      await pudgyPenguins.withdrawAll();
      
      const balance = await ethers.provider.getBalance(await pudgyPenguins.getAddress());
      expect(balance).to.equal(0);
    });

    it("非所有者不能提现", async function () {
      await expect(
        pudgyPenguins.connect(addr1).withdrawAll()
      ).to.be.reverted;
    });
  });
});

