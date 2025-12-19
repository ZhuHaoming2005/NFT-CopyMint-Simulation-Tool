const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Copymints对比分析脚本
 * 用于研究同一合约在不同链上的表现差异
 */

async function loadDeployments() {
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    throw new Error("未找到部署目录！请先部署合约");
  }

  const files = fs.readdirSync(deploymentsDir).filter(f => f.endsWith("-latest.json"));
  const deployments = {};

  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(path.join(deploymentsDir, file), "utf8"));
    deployments[content.network] = content;
  }

  return deployments;
}

async function getContractInfo(network, contractAddress) {
  console.log(`\n🔍 查询 ${network} 上的合约信息...`);

  try {
    // 动态切换网络
    const provider = new hre.ethers.JsonRpcProvider(
      hre.config.networks[network].url
    );

    const PudgyPenguins = await hre.ethers.getContractFactory("PudgyPenguins");
    const contract = PudgyPenguins.attach(contractAddress).connect(provider);

    const info = {
      network,
      address: contractAddress,
      name: await contract.name(),
      symbol: await contract.symbol(),
      totalSupply: await contract.totalMint(),
      maxSupply: await contract.MAX_ELEMENTS(),
      price: await contract.PRICE(),
      maxByMint: await contract.MAX_BY_MINT(),
      paused: await contract.paused(),
      owner: await contract.owner(),
      baseURI: await contract._baseURI().catch(() => "无法访问")
    };

    console.log("✅ 查询成功");
    return info;
  } catch (error) {
    console.error(`❌ 查询失败: ${error.message}`);
    return null;
  }
}

async function compareContracts(deployments) {
  console.log("\n" + "=".repeat(80));
  console.log("📊 Copymints 对比分析");
  console.log("=".repeat(80));

  const contractInfos = [];

  for (const [network, deployment] of Object.entries(deployments)) {
    const info = await getContractInfo(network, deployment.contractAddress);
    if (info) {
      contractInfos.push(info);
    }
  }

  if (contractInfos.length === 0) {
    console.error("❌ 没有可用的合约信息");
    return;
  }

  // 生成对比表格
  console.log("\n" + "=".repeat(80));
  console.log("📋 合约对比表");
  console.log("=".repeat(80));

  console.log("\n基本信息:");
  console.log("-".repeat(80));
  contractInfos.forEach(info => {
    console.log(`\n【${info.network.toUpperCase()}】`);
    console.log(`  地址: ${info.address}`);
    console.log(`  名称: ${info.name} (${info.symbol})`);
    console.log(`  所有者: ${info.owner}`);
  });

  console.log("\n供应量信息:");
  console.log("-".repeat(80));
  contractInfos.forEach(info => {
    const supplyPercent = (Number(info.totalSupply) / Number(info.maxSupply) * 100).toFixed(2);
    console.log(`${info.network.padEnd(15)} | 已mint: ${String(info.totalSupply).padEnd(6)} / ${info.maxSupply} (${supplyPercent}%)`);
  });

  console.log("\n价格信息:");
  console.log("-".repeat(80));
  contractInfos.forEach(info => {
    const priceEth = hre.ethers.formatEther(info.price);
    console.log(`${info.network.padEnd(15)} | 单价: ${priceEth} ETH | 单次最大: ${info.maxByMint}`);
  });

  console.log("\n状态信息:");
  console.log("-".repeat(80));
  contractInfos.forEach(info => {
    const status = info.paused ? "⏸️  已暂停" : "▶️  运行中";
    console.log(`${info.network.padEnd(15)} | ${status}`);
  });

  // 差异分析
  console.log("\n" + "=".repeat(80));
  console.log("🔬 差异分析");
  console.log("=".repeat(80));

  const uniqueTotalSupplies = new Set(contractInfos.map(i => i.totalSupply.toString()));
  const uniquePausedStates = new Set(contractInfos.map(i => i.paused));
  const uniqueOwners = new Set(contractInfos.map(i => i.owner.toLowerCase()));

  console.log("\n发现的差异:");
  if (uniqueTotalSupplies.size > 1) {
    console.log("⚠️  不同链上的mint数量不一致！");
    contractInfos.forEach(info => {
      console.log(`   - ${info.network}: ${info.totalSupply}`);
    });
  } else {
    console.log("✓ 所有链上的mint数量一致");
  }

  if (uniquePausedStates.size > 1) {
    console.log("⚠️  不同链上的暂停状态不一致！");
    contractInfos.forEach(info => {
      console.log(`   - ${info.network}: ${info.paused ? "已暂停" : "运行中"}`);
    });
  } else {
    console.log("✓ 所有链上的暂停状态一致");
  }

  if (uniqueOwners.size > 1) {
    console.log("⚠️  不同链上的所有者不一致！");
    contractInfos.forEach(info => {
      console.log(`   - ${info.network}: ${info.owner}`);
    });
  } else {
    console.log("✓ 所有链上的所有者一致");
  }

  // 保存对比报告
  const report = {
    timestamp: new Date().toISOString(),
    contractInfos,
    analysis: {
      totalSupplyConsistent: uniqueTotalSupplies.size === 1,
      pausedStateConsistent: uniquePausedStates.size === 1,
      ownerConsistent: uniqueOwners.size === 1
    }
  };

  const reportsDir = path.join(__dirname, "..", "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir);
  }

  const reportFile = path.join(reportsDir, `copymint-comparison-${Date.now()}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n📝 对比报告已保存到: ${reportFile}`);

  console.log("\n✨ 分析完成！");
}

async function main() {
  console.log("🔬 NFT Copymints 对比分析工具");
  console.log("=".repeat(80));

  const deployments = await loadDeployments();
  const networkCount = Object.keys(deployments).length;

  console.log(`\n找到 ${networkCount} 个已部署的网络:`);
  Object.keys(deployments).forEach(network => {
    console.log(`  - ${network}`);
  });

  if (networkCount === 0) {
    console.error("\n❌ 没有找到任何部署！请先运行部署脚本。");
    return;
  }

  await compareContracts(deployments);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 分析失败:", error);
    process.exit(1);
  });

