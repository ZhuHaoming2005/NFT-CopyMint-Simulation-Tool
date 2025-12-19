const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * NFT信息查询脚本
 * 支持查询tokenURI、所有者、元数据等信息
 */

// ==================== 配置区域 ====================
const QUERY_CONFIG = {
  // 合约地址
  contractAddress: process.env.CONTRACT_ADDRESS || null,
  
  // 查询的Token ID（支持单个或范围）
  tokenId: process.env.TOKEN_ID ? parseInt(process.env.TOKEN_ID) : null,
  tokenIdStart: process.env.TOKEN_ID_START ? parseInt(process.env.TOKEN_ID_START) : null,
  tokenIdEnd: process.env.TOKEN_ID_END ? parseInt(process.env.TOKEN_ID_END) : null,
  
  // 查询特定地址拥有的所有tokens
  ownerAddress: process.env.OWNER_ADDRESS || null,
  
  // 是否显示详细信息
  verbose: process.env.VERBOSE !== "false"
};
// ================================================

async function loadContractAddress(network) {
  if (QUERY_CONFIG.contractAddress) {
    return QUERY_CONFIG.contractAddress;
  }

  const deploymentFile = path.join(__dirname, "..", "deployments", `${network}-latest.json`);
  if (fs.existsSync(deploymentFile)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    return deployment.contractAddress;
  }

  throw new Error("未找到合约地址！请设置CONTRACT_ADDRESS环境变量或先部署合约");
}

async function queryTokenInfo(contract, tokenId) {
  try {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🎫 Token ID: ${tokenId}`);
    console.log("=".repeat(60));

    // 查询token所有者
    const owner = await contract.ownerOf(tokenId);
    console.log("👤 所有者:", owner);

    // 查询tokenURI
    const tokenURI = await contract.tokenURI(tokenId);
    console.log("🔗 Token URI:", tokenURI);

    // 如果是verbose模式，尝试获取元数据
    if (QUERY_CONFIG.verbose && tokenURI.startsWith("http")) {
      try {
        console.log("\n📦 正在获取元数据...");
        const response = await fetch(tokenURI);
        if (response.ok) {
          const metadata = await response.json();
          console.log("✅ 元数据内容:");
          console.log(JSON.stringify(metadata, null, 2));
        } else {
          console.log("⚠️  无法获取元数据 (HTTP " + response.status + ")");
        }
      } catch (error) {
        console.log("⚠️  无法获取元数据:", error.message);
      }
    }

    return {
      tokenId,
      owner,
      tokenURI
    };
  } catch (error) {
    console.log(`\n❌ Token ID ${tokenId} 查询失败:`, error.message);
    return null;
  }
}

async function queryTokensByOwner(contract, ownerAddress) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`👤 查询地址 ${ownerAddress} 拥有的所有NFT`);
  console.log("=".repeat(60));

  try {
    // 查询余额
    const balance = await contract.balanceOf(ownerAddress);
    console.log(`\n💼 持有数量: ${balance.toString()}`);

    if (balance == 0) {
      console.log("该地址没有持有任何NFT");
      return [];
    }

    // 获取所有token IDs
    const tokenIds = await contract.walletOfOwner(ownerAddress);
    console.log(`\n🎫 Token IDs: ${tokenIds.map(t => t.toString()).join(", ")}`);

    // 查询每个token的URI
    const tokens = [];
    for (let i = 0; i < tokenIds.length; i++) {
      const tokenId = tokenIds[i];
      const tokenURI = await contract.tokenURI(tokenId);
      tokens.push({
        tokenId: tokenId.toString(),
        tokenURI
      });
      console.log(`   ${i + 1}. Token #${tokenId.toString()}: ${tokenURI}`);
    }

    return tokens;
  } catch (error) {
    console.error("❌ 查询失败:", error.message);
    return [];
  }
}

async function queryContractInfo(contract) {
  console.log("\n" + "=".repeat(60));
  console.log("📊 合约基本信息");
  console.log("=".repeat(60));

  const name = await contract.name();
  const symbol = await contract.symbol();
  const totalSupply = await contract.totalMint();
  const maxSupply = await contract.MAX_ELEMENTS();
  const baseURI = await contract.baseTokenURI();
  const owner = await contract.owner();
  const paused = await contract.paused();

  console.log("- 名称:", name);
  console.log("- 符号:", symbol);
  console.log("- 总供应量:", totalSupply.toString(), "/", maxSupply.toString());
  console.log("- Base URI:", baseURI);
  console.log("- 合约所有者:", owner);
  console.log("- 暂停状态:", paused ? "已暂停" : "运行中");

  return {
    name,
    symbol,
    totalSupply: totalSupply.toString(),
    maxSupply: maxSupply.toString(),
    baseURI,
    owner,
    paused
  };
}

async function main() {
  console.log("🔍 NFT信息查询工具");
  console.log("📡 网络:", hre.network.name);
  console.log("=".repeat(60));

  // 获取签名者
  const [signer] = await hre.ethers.getSigners();
  console.log("👤 查询账户:", signer.address);

  // 加载合约
  const contractAddress = await loadContractAddress(hre.network.name);
  console.log("📄 合约地址:", contractAddress);

  const PudgyPenguins = await hre.ethers.getContractFactory("PudgyPenguins");
  const contract = PudgyPenguins.attach(contractAddress);

  // 查询合约基本信息
  const contractInfo = await queryContractInfo(contract);

  // 根据配置执行不同的查询
  const results = {
    contract: contractInfo,
    tokens: []
  };

  // 情况1: 查询特定地址的所有tokens
  if (QUERY_CONFIG.ownerAddress) {
    const tokens = await queryTokensByOwner(contract, QUERY_CONFIG.ownerAddress);
    results.tokens = tokens;
  }
  // 情况2: 查询token ID范围
  else if (QUERY_CONFIG.tokenIdStart !== null && QUERY_CONFIG.tokenIdEnd !== null) {
    console.log(`\n查询Token ID范围: ${QUERY_CONFIG.tokenIdStart} - ${QUERY_CONFIG.tokenIdEnd}`);
    for (let id = QUERY_CONFIG.tokenIdStart; id <= QUERY_CONFIG.tokenIdEnd; id++) {
      const info = await queryTokenInfo(contract, id);
      if (info) results.tokens.push(info);
    }
  }
  // 情况3: 查询单个token ID
  else if (QUERY_CONFIG.tokenId !== null) {
    const info = await queryTokenInfo(contract, QUERY_CONFIG.tokenId);
    if (info) results.tokens.push(info);
  }
  // 情况4: 查询所有已mint的tokens
  else {
    const totalSupply = parseInt(contractInfo.totalSupply);
    if (totalSupply === 0) {
      console.log("\n⚠️  合约中还没有mint任何NFT");
    } else {
      console.log(`\n查询所有已mint的NFT (总共 ${totalSupply} 个)`);
      
      // 如果数量太多，提示用户
      if (totalSupply > 20) {
        console.log(`⚠️  NFT数量较多，这可能需要一些时间...`);
        console.log(`💡 提示: 使用 TOKEN_ID_START 和 TOKEN_ID_END 环境变量来限制查询范围`);
      }

      for (let id = 0; id < totalSupply; id++) {
        const info = await queryTokenInfo(contract, id);
        if (info) results.tokens.push(info);
        
        // 避免输出过多，超过20个就只显示摘要
        if (id >= 20 && totalSupply > 20) {
          console.log(`\n... 省略剩余 ${totalSupply - 20} 个NFT的详细信息 ...`);
          console.log(`使用 TOKEN_ID 或 TOKEN_ID_START/END 参数查询特定范围`);
          break;
        }
      }
    }
  }

  // 保存查询结果
  if (results.tokens.length > 0) {
    const resultsDir = path.join(__dirname, "..", "query-results");
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir);
    }

    const timestamp = Date.now();
    const resultFile = path.join(resultsDir, `${hre.network.name}-query-${timestamp}.json`);
    fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
    console.log(`\n📝 查询结果已保存到: ${resultFile}`);
  }

  // 汇总信息
  console.log("\n" + "=".repeat(60));
  console.log("📊 查询汇总");
  console.log("=".repeat(60));
  console.log(`✅ 查询完成! 共查询了 ${results.tokens.length} 个NFT`);

  console.log("\n✨ 查询完成！");
}

// 执行查询
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 查询失败:", error);
    process.exit(1);
  });

// 导出用于编程调用
module.exports = { QUERY_CONFIG, main, queryTokenInfo, queryTokensByOwner };


