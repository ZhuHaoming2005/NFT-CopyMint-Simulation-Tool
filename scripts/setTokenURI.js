const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 设置和管理TokenURI脚本
 * 支持修改baseURI等操作
 */

// ==================== 配置区域 ====================
const CONFIG = {
  // 合约地址
  contractAddress: process.env.CONTRACT_ADDRESS || null,
  
  // 新的Base URI
  newBaseURI: process.env.NEW_BASE_URI || null,
  
  // 操作类型: 'set' (设置baseURI), 'query' (查询当前baseURI)
  operation: process.env.OPERATION || "query"
};
// ================================================

async function loadContractAddress(network) {
  if (CONFIG.contractAddress) {
    return CONFIG.contractAddress;
  }

  const deploymentFile = path.join(__dirname, "..", "deployments", `${network}-latest.json`);
  if (fs.existsSync(deploymentFile)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    return deployment.contractAddress;
  }

  throw new Error("未找到合约地址！请设置CONTRACT_ADDRESS环境变量或先部署合约");
}

async function main() {
  console.log("🔧 TokenURI管理工具");
  console.log("📡 网络:", hre.network.name);
  console.log("=".repeat(60));

  // 获取签名者
  const [signer] = await hre.ethers.getSigners();
  console.log("👤 操作账户:", signer.address);

  // 加载合约
  const contractAddress = await loadContractAddress(hre.network.name);
  console.log("📄 合约地址:", contractAddress);

  const PudgyPenguins = await hre.ethers.getContractFactory("PudgyPenguins");
  const contract = PudgyPenguins.attach(contractAddress);

  // 查询当前状态
  console.log("\n" + "=".repeat(60));
  console.log("📊 当前状态");
  console.log("=".repeat(60));

  const currentBaseURI = await contract.baseTokenURI();
  const owner = await contract.owner();
  const totalSupply = await contract.totalMint();

  console.log("- 当前Base URI:", currentBaseURI);
  console.log("- 合约所有者:", owner);
  console.log("- 已mint数量:", totalSupply.toString());
  console.log("- 是否为所有者:", signer.address.toLowerCase() === owner.toLowerCase());

  // 如果是query操作，只查询
  if (CONFIG.operation === "query") {
    console.log("\n✅ 查询完成");
    
    // 如果有已mint的token，显示示例tokenURI
    if (totalSupply > 0) {
      console.log("\n📋 Token URI 示例:");
      for (let i = 0; i < Math.min(5, Number(totalSupply)); i++) {
        const uri = await contract.tokenURI(i);
        console.log(`  Token #${i}: ${uri}`);
      }
    }
    return;
  }

  // 如果是set操作，需要所有者权限
  if (CONFIG.operation === "set") {
    if (!CONFIG.newBaseURI) {
      console.error("\n❌ 错误: 请通过NEW_BASE_URI环境变量指定新的Base URI");
      return;
    }

    if (signer.address.toLowerCase() !== owner.toLowerCase()) {
      console.error("\n❌ 错误: 只有合约所有者才能修改Base URI");
      return;
    }

    console.log("\n" + "=".repeat(60));
    console.log("🔄 修改Base URI");
    console.log("=".repeat(60));
    console.log("旧Base URI:", currentBaseURI);
    console.log("新Base URI:", CONFIG.newBaseURI);

    // 确认
    console.log("\n⚠️  即将修改Base URI，这将影响所有NFT的tokenURI");
    console.log("继续执行...");

    try {
      const tx = await contract.setBaseURI(CONFIG.newBaseURI);
      console.log("\n⏳ 交易已发送:", tx.hash);
      console.log("等待确认...");

      const receipt = await tx.wait();
      console.log("✅ Base URI已更新!");
      console.log("📦 区块号:", receipt.blockNumber);
      console.log("⛽ Gas消耗:", receipt.gasUsed.toString());

      // 验证新的URI
      const newBaseURI = await contract.baseTokenURI();
      console.log("\n验证新Base URI:", newBaseURI);

      // 如果有已mint的token，显示更新后的tokenURI
      if (totalSupply > 0) {
        console.log("\n📋 更新后的Token URI示例:");
        for (let i = 0; i < Math.min(3, Number(totalSupply)); i++) {
          const uri = await contract.tokenURI(i);
          console.log(`  Token #${i}: ${uri}`);
        }
      }

      console.log("\n✨ 操作完成！");
    } catch (error) {
      console.error("\n❌ 修改失败:", error.message);
      throw error;
    }
  } else {
    console.error(`\n❌ 未知操作: ${CONFIG.operation}`);
    console.log("支持的操作: 'query' (查询) 或 'set' (设置)");
  }
}

// 执行
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


