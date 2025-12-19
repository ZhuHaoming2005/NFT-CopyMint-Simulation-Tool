const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 开始部署NFT合约...");
  console.log("📡 网络:", hre.network.name);

  // 获取部署账户
  const [deployer] = await hre.ethers.getSigners();
  console.log("💼 部署账户:", deployer.address);
  
  // 获取账户余额
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 账户余额:", hre.ethers.formatEther(balance), "ETH");

  // 从环境变量或配置中获取baseURI
  const baseURI = process.env.BASE_URI || "https://ipfs.io/ipfs/QmWXJXRdExse2YHRY21Wvh4pjRxNRQcWVhcKw4DLVnqGqs/";
  console.log("🔗 Base URI:", baseURI);

  // 部署合约
  console.log("\n📦 正在编译和部署 PudgyPenguins 合约...");
  const PudgyPenguins = await hre.ethers.getContractFactory("PudgyPenguins");
  const pudgyPenguins = await PudgyPenguins.deploy(baseURI);

  await pudgyPenguins.waitForDeployment();
  const contractAddress = await pudgyPenguins.getAddress();

  console.log("✅ PudgyPenguins 合约已部署到:", contractAddress);

  // 保存部署信息
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: contractAddress,
    deployer: deployer.address,
    baseURI: baseURI,
    timestamp: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber(),
    transactionHash: pudgyPenguins.deploymentTransaction().hash
  };

  // 确保目录存在
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  // 保存到文件
  const filename = path.join(deploymentsDir, `${hre.network.name}-latest.json`);
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log("📝 部署信息已保存到:", filename);

  // 如果不是本地网络，等待一段时间后验证合约
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n⏳ 等待区块确认...");
    await pudgyPenguins.deploymentTransaction().wait(6);
    
    console.log("\n🔍 验证合约...");
    console.log("运行以下命令来验证合约:");
    console.log(`npx hardhat verify --network ${hre.network.name} ${contractAddress} "${baseURI}"`);
  }

  // 显示合约基本信息
  console.log("\n📊 合约信息:");
  console.log("- 名称:", await pudgyPenguins.name());
  console.log("- 符号:", await pudgyPenguins.symbol());
  console.log("- 最大供应量:", await pudgyPenguins.MAX_ELEMENTS());
  console.log("- 单价:", hre.ethers.formatEther(await pudgyPenguins.PRICE()), "ETH");
  console.log("- 单次最大mint数量:", await pudgyPenguins.MAX_BY_MINT());
  console.log("- 当前暂停状态:", await pudgyPenguins.paused());

  console.log("\n✨ 部署完成!");
  
  return {
    contract: pudgyPenguins,
    address: contractAddress
  };
}

// 执行部署
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 部署失败:", error);
    process.exit(1);
  });

