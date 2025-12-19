# 使用指南 - NFT TokenURI 功能

## 📚 概述

本项目提供了完整的NFT部署、mint和查询工具。合约已经内置了tokenURI功能，可以通过以下方式使用。

## 🎯 TokenURI 功能说明

### 合约中的TokenURI实现

PudgyPenguins合约继承自ERC721，自动实现了`tokenURI(uint256 tokenId)`函数：

```solidity
// 获取baseURI
function _baseURI() internal view virtual override returns (string memory) {
    return baseTokenURI;
}

// tokenURI会自动返回: baseURI + tokenId
// 例如: https://ipfs.io/ipfs/QmXXX/ + 0 = https://ipfs.io/ipfs/QmXXX/0
```

### 设置Base URI

部署时会设置初始的baseURI，之后可以通过合约所有者修改：

```solidity
function setBaseURI(string memory baseURI) public onlyOwner {
    baseTokenURI = baseURI;
}
```

## 🔍 查询NFT信息

### 1. 查询所有已mint的NFT

```bash
# 基本用法
npm run query:sepolia

# 指定合约地址
CONTRACT_ADDRESS=0x你的合约地址 npm run query:sepolia
```

**输出示例：**
```
🔍 NFT信息查询工具
📡 网络: sepolia
============================================
👤 查询账户: 0x123...
📄 合约地址: 0xABC...

📊 合约基本信息
============================================
- 名称: PudgyPenguins
- 符号: PPG
- 总供应量: 5 / 8888
- Base URI: https://ipfs.io/ipfs/QmXXX/
- 合约所有者: 0x123...
- 暂停状态: 运行中

🎫 Token ID: 0
============================================
👤 所有者: 0x456...
🔗 Token URI: https://ipfs.io/ipfs/QmXXX/0
```

### 2. 查询特定Token ID

```bash
# Windows PowerShell
$env:TOKEN_ID="5"; npm run query:sepolia

# Linux/Mac
TOKEN_ID=5 npm run query:sepolia
```

### 3. 查询Token ID范围

```bash
# Windows PowerShell
$env:TOKEN_ID_START="0"; $env:TOKEN_ID_END="10"; npm run query:sepolia

# Linux/Mac
TOKEN_ID_START=0 TOKEN_ID_END=10 npm run query:sepolia
```

### 4. 查询特定地址拥有的所有NFT

```bash
# Windows PowerShell
$env:OWNER_ADDRESS="0x你的地址"; npm run query:sepolia

# Linux/Mac
OWNER_ADDRESS=0x你的地址 npm run query:sepolia
```

**输出示例：**
```
👤 查询地址 0x456... 拥有的所有NFT
============================================

💼 持有数量: 3

🎫 Token IDs: 0, 1, 2

   1. Token #0: https://ipfs.io/ipfs/QmXXX/0
   2. Token #1: https://ipfs.io/ipfs/QmXXX/1
   3. Token #2: https://ipfs.io/ipfs/QmXXX/2
```

## 🔧 管理TokenURI

### 1. 查询当前Base URI

```bash
# Windows PowerShell
$env:OPERATION="query"; npm run set-uri:sepolia

# Linux/Mac
OPERATION=query npm run set-uri:sepolia
```

### 2. 修改Base URI（需要合约所有者权限）

```bash
# Windows PowerShell
$env:OPERATION="set"; $env:NEW_BASE_URI="https://new-uri.com/"; npm run set-uri:sepolia

# Linux/Mac
OPERATION=set NEW_BASE_URI="https://new-uri.com/" npm run set-uri:sepolia
```

**注意事项：**
- 只有合约所有者可以修改Base URI
- 修改后会影响所有NFT的tokenURI
- Base URI应该以 `/` 结尾

## 📊 环境变量参考

### queryNFT.js 脚本支持的环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `CONTRACT_ADDRESS` | 合约地址 | `0x123...` |
| `TOKEN_ID` | 查询单个Token ID | `5` |
| `TOKEN_ID_START` | 查询范围起始 | `0` |
| `TOKEN_ID_END` | 查询范围结束 | `10` |
| `OWNER_ADDRESS` | 查询地址拥有的tokens | `0x456...` |
| `VERBOSE` | 是否显示详细信息 | `true`/`false` |

### setTokenURI.js 脚本支持的环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `CONTRACT_ADDRESS` | 合约地址 | `0x123...` |
| `OPERATION` | 操作类型 | `query`/`set` |
| `NEW_BASE_URI` | 新的Base URI | `https://new-uri.com/` |

## 🎨 完整使用流程示例

### 场景：部署、mint、查询、修改URI

```bash
# 1. 部署合约到Sepolia
npm run deploy:sepolia

# 2. 取消暂停并mint几个NFT
npm run test:mint:sepolia

# 3. 查询所有已mint的NFT
npm run query:sepolia

# 4. 查询特定Token的信息
$env:TOKEN_ID="0"; npm run query:sepolia

# 5. 查询自己地址拥有的所有NFT
$env:OWNER_ADDRESS="0x你的地址"; npm run query:sepolia

# 6. 修改Base URI（如果需要）
$env:OPERATION="set"; $env:NEW_BASE_URI="https://new-metadata-uri.com/"; npm run set-uri:sepolia

# 7. 验证修改后的tokenURI
$env:TOKEN_ID="0"; npm run query:sepolia
```

## 🌐 多链对比

### 研究copymints - 对比不同链上的tokenURI

```bash
# 1. 部署到多个网络
npm run deploy:sepolia
npm run deploy:amoy
npm run deploy:base-sepolia

# 2. 在每个网络上mint相同数量
npm run test:mint:sepolia
npm run test:mint:amoy
npm run test:mint:base-sepolia

# 3. 查询每个网络的tokenURI
npm run query:sepolia > sepolia-tokens.txt
npm run query:amoy > amoy-tokens.txt
npm run query:base-sepolia > base-sepolia-tokens.txt

# 4. 运行对比分析
npm run compare
```

## 📝 直接调用合约方法（通过ethers.js）

如果你想在自己的脚本中调用tokenURI：

```javascript
const hre = require("hardhat");

async function getTokenURI() {
  const contractAddress = "0x你的合约地址";
  const PudgyPenguins = await hre.ethers.getContractFactory("PudgyPenguins");
  const contract = PudgyPenguins.attach(contractAddress);
  
  // 查询Token 0的URI
  const tokenURI = await contract.tokenURI(0);
  console.log("Token URI:", tokenURI);
  
  // 查询Base URI
  const baseURI = await contract.baseTokenURI();
  console.log("Base URI:", baseURI);
  
  // 查询某地址拥有的所有tokens
  const tokens = await contract.walletOfOwner("0x地址");
  console.log("Tokens:", tokens);
  
  // 批量查询tokenURIs
  for (const tokenId of tokens) {
    const uri = await contract.tokenURI(tokenId);
    console.log(`Token #${tokenId}: ${uri}`);
  }
}

getTokenURI();
```

## 🔗 区块浏览器查看

部署后，也可以直接在区块浏览器上查看和调用tokenURI：

1. 访问对应网络的区块浏览器
   - Sepolia: https://sepolia.etherscan.io/
   - Polygon Amoy: https://amoy.polygonscan.com/
   - Base Sepolia: https://sepolia.basescan.org/

2. 输入合约地址

3. 点击 "Contract" -> "Read Contract"

4. 找到 `tokenURI` 函数，输入tokenId查询

## 💡 常见问题

### Q: tokenURI返回的格式是什么？

A: 默认返回 `baseURI + tokenId`，例如：
- Base URI: `https://ipfs.io/ipfs/QmXXX/`
- Token ID: `5`
- 结果: `https://ipfs.io/ipfs/QmXXX/5`

### Q: 如何让tokenURI返回JSON元数据？

A: 将元数据JSON文件上传到IPFS或其他存储，文件名为tokenId（如`0`, `1`, `2`...），然后设置Base URI为该目录。

### Q: 可以为每个token设置不同的URI吗？

A: 当前合约使用统一的baseURI。如需为每个token单独设置URI，需要修改合约添加mapping存储。

### Q: 修改Base URI后，之前mint的NFT会受影响吗？

A: 会的。因为tokenURI是动态计算的（baseURI + tokenId），修改baseURI会影响所有NFT。

## 🎓 元数据标准

推荐的NFT元数据JSON格式（ERC721标准）：

```json
{
  "name": "PudgyPenguin #0",
  "description": "A cute penguin from the Pudgy Penguins collection",
  "image": "https://ipfs.io/ipfs/QmYYY/0.png",
  "attributes": [
    {
      "trait_type": "Background",
      "value": "Blue"
    },
    {
      "trait_type": "Body",
      "value": "Normal"
    }
  ]
}
```

将此文件命名为 `0`, `1`, `2` 等（无扩展名），上传到IPFS，然后设置Base URI为该目录。

## 📚 相关资源

- [ERC-721 标准](https://eips.ethereum.org/EIPS/eip-721)
- [NFT元数据标准](https://docs.opensea.io/docs/metadata-standards)
- [IPFS文档](https://docs.ipfs.tech/)
- [Pinata IPFS服务](https://www.pinata.cloud/)

---

**提示：** 查询结果会自动保存到 `query-results/` 目录，方便后续分析和对比。

