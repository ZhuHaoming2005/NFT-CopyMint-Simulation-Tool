const hre = require("hardhat");
const { exec } = require("child_process");
const util = require("util");

const execPromise = util.promisify(exec);

/**
 * 多链部署脚本
 * 支持一键部署到多个测试网进行copymints研究
 */

// 配置要部署的网络列表
const NETWORKS = [
  "sepolia",    // Ethereum测试网
  "amoy",     // Polygon测试网
  "BaseSepolia",     // BaseSepolia测试网
  "BSCTestnet",     // BSCTestnet测试网
];

const DELAY_BETWEEN_DEPLOYS = 5000; // 部署间隔（毫秒）

async function deployToNetwork(network) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 正在部署到 ${network.toUpperCase()}`);
  console.log(`${"=".repeat(60)}\n`);

  try {
    const { stdout, stderr } = await execPromise(
      `npx hardhat run scripts/deploy.js --network ${network}`,
      { maxBuffer: 1024 * 1024 * 10 }
    );

    console.log(stdout);
    if (stderr) console.error(stderr);

    console.log(`✅ ${network} 部署成功`);
    return { network, success: true };
  } catch (error) {
    console.error(`❌ ${network} 部署失败:`, error.message);
    return { network, success: false, error: error.message };
  }
}

async function main() {
  console.log("🌐 多链部署工具 - NFT Copymints研究");
  console.log("=" .repeat(60));
  console.log(`将部署到以下网络: ${NETWORKS.join(", ")}`);
  console.log("=" .repeat(60));

  const results = [];

  for (const network of NETWORKS) {
    const result = await deployToNetwork(network);
    results.push(result);

    // 在部署之间添加延迟
    if (network !== NETWORKS[NETWORKS.length - 1]) {
      console.log(`\n⏳ 等待 ${DELAY_BETWEEN_DEPLOYS / 1000} 秒后继续...\n`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_DEPLOYS));
    }
  }

  // 打印汇总
  console.log("\n" + "=".repeat(60));
  console.log("📊 部署汇总");
  console.log("=".repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n✅ 成功: ${successful.length}/${NETWORKS.length}`);
  successful.forEach(r => {
    console.log(`   - ${r.network}`);
  });

  if (failed.length > 0) {
    console.log(`\n❌ 失败: ${failed.length}/${NETWORKS.length}`);
    failed.forEach(r => {
      console.log(`   - ${r.network}: ${r.error}`);
    });
  }

  console.log("\n💡 提示:");
  console.log("   - 查看部署详情: 查看 deployments/ 目录");
  console.log("   - 验证合约: npm run verify:<network>");
  console.log("   - 测试mint: CONTRACT_ADDRESS=<地址> npm run test:mint");

  console.log("\n✨ 多链部署完成！");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 多链部署失败:", error);
    process.exit(1);
  });

