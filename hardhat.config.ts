import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';
import 'dotenv/config';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.30',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: 'cancun'
    }
  },
  networks: {
    // Ethereum testnet
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/mIT4inrExfxdYLGFwodu5',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111
    },
    // Polygon testnet
    amoy: {
      url: process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80002
    },
    // Base testnet
    baseSepolia: {
      url: process.env.BASESEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532
    },
    // BSC testnet
    bscTestnet: {
      url: process.env.BSCTESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 97
    },
    // Mainnets
    // Ethereum mainnet
    mainnet: {
      url: process.env.MAINNET_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/mIT4inrExfxdYLGFwodu5',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1
    },
    // Polygon mainnet
    polygon: {
      url: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 137
    },
    // Base mainnet
    base: {
      url: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 8453
    },
    // BSC mainnet
    bsc: {
      url: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 56
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || '5S6SMJYGF2H28RZWVV97YXQMQHTWFG7N3M'
  },
  sourcify: {
    enabled: false
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts'
  }
};

export default config;
