const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * NFT Mint 测试脚本
 * 支持自定义参数测试不同的mint场景
 */

// ==================== 配置区域 ====================
const TEST_CONFIG = {
  // 从部署文件读取合约地址，或手动指定
  contractAddress: process.env.CONTRACT_ADDRESS || null,
  
  // Mint配置
  mintTo: process.env.MINT_TO || null, // 接收地址，null则使用当前账户
  mintCount: parseInt(process.env.MINT_COUNT) || 1, // mint数量
  
  // 是否在mint前取消暂停（如果合约处于暂停状态）
  unpauseBeforeMint: process.env.UNPAUSE === "true" || true,
  
  // 是否显示详细信息
  verbose: process.env.VERBOSE === "true" || true
};
// ================================================

async function loadContractAddress(network) {
  if (TEST_CONFIG.contractAddress) {
    return TEST_CONFIG.contractAddress;
  }

  const deploymentFile = path.join(__dirname, "..", "deployments", `${network}-latest.json`);
  if (fs.existsSync(deploymentFile)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    return deployment.contractAddress;
  }

  throw new Error("未找到合约地址！请设置CONTRACT_ADDRESS环境变量或先部署合约");
}

async function main() {
  console.log("🧪 NFT Mint 测试脚本");
  console.log("📡 网络:", hre.network.name);
  console.log("=".repeat(50));

  // 获取签名者
  const [signer] = await hre.ethers.getSigners();
  console.log("👤 测试账户:", signer.address);
  
  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log("💰 账户余额:", hre.ethers.formatEther(balance), "ETH");

  // 加载合约
  const contractAddress = await loadContractAddress(hre.network.name);
  console.log("📄 合约地址:", contractAddress);

  const PudgyPenguins = await hre.ethers.getContractFactory("PudgyPenguins");
  const contract = PudgyPenguins.attach(contractAddress);

  // 获取mint接收地址
  const mintTo = TEST_CONFIG.mintTo || signer.address;
  console.log("🎯 Mint接收地址:", mintTo);
  console.log("🔢 Mint数量:", TEST_CONFIG.mintCount);

  console.log("\n" + "=".repeat(50));
  console.log("📊 合约当前状态");
  console.log("=".repeat(50));

  // 查询合约状态
  const totalSupply = await contract.totalMint();
  const maxElements = await contract.MAX_ELEMENTS();
  const price = await contract.PRICE();
  const maxByMint = await contract.MAX_BY_MINT();
  const isPaused = await contract.paused();
  const owner = await contract.owner();
  const balanceOfMintTo = await contract.balanceOf(mintTo);

  console.log("- 已mint数量:", totalSupply.toString());
  console.log("- 最大供应量:", maxElements.toString());
  console.log("- 单价:", hre.ethers.formatEther(price), "ETH");
  console.log("- 单次最大mint:", maxByMint.toString());
  console.log("- 暂停状态:", isPaused);
  console.log("- 合约所有者:", owner);
  console.log("- 目标地址持有数量:", balanceOfMintTo.toString());

  // 检查mint条件
  console.log("\n" + "=".repeat(50));
  console.log("🔍 检查Mint条件");
  console.log("=".repeat(50));

  const isOwner = signer.address.toLowerCase() === owner.toLowerCase();
  console.log("✓ 是否为合约所有者:", isOwner);

  if (TEST_CONFIG.mintCount > maxByMint) {
    console.error("❌ Mint数量超过单次最大限制！");
    return;
  }
  console.log("✓ Mint数量检查通过");

  if (totalSupply + BigInt(TEST_CONFIG.mintCount) > maxElements) {
    console.error("❌ Mint后将超过最大供应量！");
    return;
  }
  console.log("✓ 供应量检查通过");

  // 计算所需费用
  const totalPrice = await contract.price(TEST_CONFIG.mintCount);
  console.log("✓ 所需费用:", hre.ethers.formatEther(totalPrice), "ETH");

  if (balance < totalPrice) {
    console.error("❌ 账户余额不足！");
    return;
  }
  console.log("✓ 余额检查通过");

  // 如果合约暂停且需要取消暂停
  if (isPaused && TEST_CONFIG.unpauseBeforeMint) {
    if (!isOwner) {
      console.error("❌ 合约处于暂停状态，但当前账户不是所有者，无法取消暂停！");
      return;
    }
    console.log("\n⏸️  合约处于暂停状态，正在取消暂停...");
    const unpauseTx = await contract.pause(false);
    await unpauseTx.wait();
    console.log("✅ 已取消暂停");
  } else if (isPaused && !isOwner) {
    console.error("❌ 合约处于暂停状态，且当前账户不是所有者！");
    return;
  }

  // 执行mint
  console.log("\n" + "=".repeat(50));
  console.log("🎨 开始Mint");
  console.log("=".repeat(50));

  try {
    console.log(`🚀 正在mint ${TEST_CONFIG.mintCount} 个NFT到 ${mintTo}...`);
    const mintTx = await contract.mint(mintTo, TEST_CONFIG.mintCount, {
      value: totalPrice
    });

    console.log("⏳ 交易已发送，等待确认...");
    console.log("📝 交易哈希:", mintTx.hash);

    const receipt = await mintTx.wait();
    console.log("✅ Mint成功！");
    console.log("📦 区块号:", receipt.blockNumber);
    console.log("⛽ Gas消耗:", receipt.gasUsed.toString());

    // 查询mint后的状态
    const newTotalSupply = await contract.totalMint();
    const newBalance = await contract.balanceOf(mintTo);

    console.log("\n" + "=".repeat(50));
    console.log("📊 Mint后状态");
    console.log("=".repeat(50));
    console.log("- 总mint数量:", newTotalSupply.toString());
    console.log("- 目标地址持有数量:", newBalance.toString());

    // 获取tokenId
    if (TEST_CONFIG.verbose) {
      console.log("\n🎫 Mint的Token ID:");
      const events = receipt.logs
        .filter(log => {
          try {
            const parsed = contract.interface.parseLog(log);
            return parsed && parsed.name === "CreatePenguin";
          } catch {
            return false;
          }
        })
        .map(log => contract.interface.parseLog(log));

      events.forEach((event, index) => {
        console.log(`  ${index + 1}. Token ID: ${event.args.id.toString()}`);
      });

      // 获取用户持有的所有tokens
      try {
        const tokens = await contract.walletOfOwner(mintTo);
        console.log("\n💼 地址持有的所有Token IDs:");
        console.log("  ", tokens.map(t => t.toString()).join(", "));
      } catch (error) {
        console.log("⚠️  无法查询持有的tokens:", error.message);
      }
    }

    console.log("\n✨ 测试完成！");

  } catch (error) {
    console.error("\n❌ Mint失败!");
    console.error("错误信息:", error.message);
    
    if (error.reason) {
      console.error("失败原因:", error.reason);
    }
    
    throw error;
  }
}

// 执行测试
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// 导出用于编程调用
module.exports = { TEST_CONFIG, main };

