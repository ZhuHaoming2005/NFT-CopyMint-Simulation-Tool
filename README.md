# NFT Copymints 研究项目

这是一个用于研究NFT copymints问题的完整开发环境，支持将同一NFT合约部署到多个测试网络进行对比分析。

## 📋 项目概述

本项目提供了一套完整的工具来研究NFT在不同区块链网络上的行为差异：

- ✅ 支持多个测试网络部署
- ✅ 可自定义mint参数进行测试
- ✅ 跨链对比分析工具
- ✅ 详细的部署和测试日志

## 🏗️ 项目结构

```
NFT-conflict/
├── contracts/              # 智能合约
│   ├── ERC721Pausable.sol
│   └── PudgyPenguins_test.sol
├── scripts/               # 部署和测试脚本
│   ├── deploy.js          # 单网络部署
│   ├── deployMultiNetwork.js  # 多网络部署
│   ├── testMint.js        # Mint测试
│   └── compareCopymints.js    # 跨链对比分析
├── deployments/           # 部署记录（自动生成）
├── reports/              # 分析报告（自动生成）
├── hardhat.config.js     # Hardhat配置
├── package.json
└── env-template.txt      # 环境变量模板
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `env-template.txt` 创建 `.env` 文件：

```bash
# Windows
copy env-template.txt .env

# Linux/Mac
cp env-template.txt .env
```

编辑 `.env` 文件，填入你的配置：

```env
# 必填：私钥（不要泄露！）
PRIVATE_KEY=你的私钥

# 可选：RPC节点URL（有默认值）
SEPOLIA_RPC_URL=https://rpc.sepolia.org
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545

# 可选：区块浏览器API密钥（用于验证合约）
ETHERSCAN_API_KEY=你的Etherscan_API密钥
POLYGONSCAN_API_KEY=你的Polygonscan_API密钥
BSCSCAN_API_KEY=你的BSCscan_API密钥

# 可选：部署配置
BASE_URI=https://ipfs.io/ipfs/你的元数据URI/
```

### 3. 编译合约

```bash
npm run compile
```

## 📦 部署合约

### 部署到单个网络

```bash
# Sepolia (Ethereum测试网)
npm run deploy:sepolia

# Mumbai (Polygon测试网)
npm run deploy:mumbai

# BSC测试网
npm run deploy:bsctest

# 本地测试网
npm run node  # 先启动本地节点
npm run deploy:localhost  # 然后部署
```

### 一键部署到多个网络

```bash
node scripts/deployMultiNetwork.js
```

这将自动部署到：
- Sepolia (Ethereum)
- Mumbai (Polygon)
- BSC Testnet

部署信息会自动保存到 `deployments/` 目录。

## 🧪 测试 Mint 功能

### 使用默认配置测试

```bash
npm run test:mint --network sepolia
```

### 自定义参数测试

使用环境变量自定义mint参数：

```bash
# Windows PowerShell
$env:CONTRACT_ADDRESS="0x123..."; $env:MINT_COUNT="5"; $env:MINT_TO="0xabc..."; npm run test:mint --network sepolia

# Linux/Mac
CONTRACT_ADDRESS=0x123... MINT_COUNT=5 MINT_TO=0xabc... npm run test:mint --network sepolia
```

支持的环境变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CONTRACT_ADDRESS` | 合约地址 | 从部署文件读取 |
| `MINT_COUNT` | mint数量 | 1 |
| `MINT_TO` | 接收地址 | 当前账户 |
| `UNPAUSE` | 是否取消暂停 | true |
| `VERBOSE` | 详细输出 | true |

### 修改测试脚本配置

你也可以直接编辑 `scripts/testMint.js` 中的 `TEST_CONFIG` 对象：

```javascript
const TEST_CONFIG = {
  contractAddress: "0x你的合约地址",
  mintCount: 3,  // mint 3个NFT
  mintTo: "0x接收地址",
  unpauseBeforeMint: true,
  verbose: true
};
```

## 🔬 跨链对比分析

部署到多个网络后，运行对比分析工具：

```bash
node scripts/compareCopymints.js
```

这将：
1. 自动读取所有已部署的网络
2. 查询每个网络上的合约状态
3. 生成对比报告
4. 识别差异和不一致

报告会保存到 `reports/` 目录。

## 🔍 验证合约

部署后验证合约源码（可选但推荐）：

```bash
# 手动验证
npx hardhat verify --network sepolia 合约地址 "baseURI参数"

# 或使用快捷命令
npm run verify:sepolia
```

## 📊 合约信息

**PudgyPenguins NFT 合约**

- 最大供应量：8888
- 单价：0.03 ETH
- 单次最大mint：20
- 特性：可暂停、可销毁、可枚举

## 🌐 支持的测试网络

| 网络 | ChainID | 获取测试币 |
|------|---------|-----------|
| Sepolia | 11155111 | [Sepolia Faucet](https://sepoliafaucet.com/) |
| Goerli | 5 | [Goerli Faucet](https://goerlifaucet.com/) |
| Mumbai | 80001 | [Mumbai Faucet](https://faucet.polygon.technology/) |
| BSC Testnet | 97 | [BSC Faucet](https://testnet.binance.org/faucet-smart) |

## 📝 常见场景

### 场景1：研究同一合约在不同链上的mint行为

```bash
# 1. 部署到多个网络
node scripts/deployMultiNetwork.js

# 2. 在每个网络上执行相同的mint操作
npm run test:mint --network sepolia
npm run test:mint --network mumbai
npm run test:mint --network bsctest

# 3. 对比分析
node scripts/compareCopymints.js
```

### 场景2：测试大批量mint

```bash
# Windows PowerShell
$env:MINT_COUNT="20"; npm run test:mint --network sepolia

# Linux/Mac
MINT_COUNT=20 npm run test:mint --network sepolia
```

### 场景3：测试暂停状态下的mint

合约默认部署时处于暂停状态。要测试暂停状态：

```bash
# 不自动取消暂停
$env:UNPAUSE="false"; npm run test:mint --network sepolia
```

### 场景4：给特定地址mint

```bash
$env:MINT_TO="0x接收地址"; npm run test:mint --network sepolia
```

## 🛠️ 高级用法

### 修改合约配置

编辑 `contracts/PudgyPenguins_test.sol`，可以修改：

```solidity
uint256 public constant MAX_ELEMENTS = 8888;  // 最大供应量
uint256 public constant PRICE = 3 * 10**16;   // 单价 (0.03 ETH)
uint256 public constant MAX_BY_MINT = 20;     // 单次最大mint
```

### 添加新的测试网络

编辑 `hardhat.config.js`，添加网络配置：

```javascript
networks: {
  yournetwork: {
    url: "RPC_URL",
    accounts: [process.env.PRIVATE_KEY],
    chainId: CHAIN_ID
  }
}
```

然后在 `package.json` 添加脚本：

```json
"deploy:yournetwork": "hardhat run scripts/deploy.js --network yournetwork"
```

## 📚 脚本详解

### deploy.js - 单网络部署

- 部署PudgyPenguins合约
- 保存部署信息到 `deployments/`
- 显示合约基本信息
- 提供验证命令

### deployMultiNetwork.js - 多网络部署

- 批量部署到多个网络
- 自动管理部署间隔
- 生成部署汇总报告

### testMint.js - Mint测试

- 支持自定义参数
- 完整的前置条件检查
- 详细的交易信息
- 自动查询TokenID

### compareCopymints.js - 跨链对比

- 自动加载所有部署
- 查询合约状态
- 生成对比表格
- 识别差异
- 保存分析报告

## ⚠️ 注意事项

1. **私钥安全**：永远不要将 `.env` 文件提交到Git！
2. **测试币**：确保账户有足够的测试币支付gas费用
3. **网络稳定性**：某些测试网可能不稳定，如果失败请重试
4. **合约暂停**：合约默认部署时处于暂停状态，需要取消暂停才能mint
5. **所有者权限**：只有合约所有者可以取消暂停

## 🐛 故障排除

### 问题1：部署失败 - 余额不足

**解决**：前往对应网络的水龙头获取测试币

### 问题2：Mint失败 - 合约暂停

**解决**：确保 `UNPAUSE=true` 或者使用合约所有者账户

### 问题3：无法连接到网络

**解决**：检查 `.env` 中的RPC URL是否正确，或使用默认URL

### 问题4：验证合约失败

**解决**：
- 确保合约已充分确认（等待几个区块）
- 检查API密钥是否正确
- 确保构造函数参数正确

## 📖 学习资源

- [Hardhat 文档](https://hardhat.org/docs)
- [OpenZeppelin 合约](https://docs.openzeppelin.com/contracts)
- [Ethers.js 文档](https://docs.ethers.org/)
- [ERC-721 标准](https://eips.ethereum.org/EIPS/eip-721)

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License

---

**祝你研究顺利！🚀**

如有问题，请查看脚本输出的详细日志或提交Issue。

