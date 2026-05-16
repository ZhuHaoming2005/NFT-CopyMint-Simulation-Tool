# NFT CopyMint Simulation Tool

A tool to copy and deploy existing NFT collections to the same or different blockchain networks, with three levels of copying: direct baseURI reuse, metadata re-upload, or full image and metadata re-upload to IPFS.

**WARNING**: This is for research purposes only. CopyMint attacks are unethical and potentially illegal.

## Demo

Watch the [Demo Video](assets/demo.mp4) here.

## Install

- Operating System: Ubuntu 24.04
- Node.js: v24.13.0

```bash
npm install
```

## Environment

Copy environment files. Then fill in the environment variables.

```bash
cp .env.template .env
```

## Commands

### Compile Contract

```bash
npm run compile
```

### CopyMint (Copy NFT Collection)

```bash
npm run copymint -- <sourceContract> [options]
```

<details>
<summary><span style="font-weight: bold;">Command Line Arguments</span></summary>

#### Required

- `<sourceContract>` - Source NFT contract address

#### Optional

- `--level <1|2|3>` - CopyMint level (default: 1)
  - Level 1: Direct baseURI copy
  - Level 2: Re-upload metadata JSON files to IPFS
  - Level 3: Re-upload images and modify metadata

- `--source-chain <chain>` - Source blockchain network (default: sepolia)
- `--target-chain <chain>` - Target blockchain network (default: sepolia)
- `--max-copy-count <n>` - Maximum tokens to copy for Level 2/3 (default: all)
  - This parameter limits the number of tokens to process during metadata/image re-upload operations, useful for testing and reducing IPFS upload costs during development.
- `--mint-count <n>` - Number of tokens to mint after deployment (default: 1)
- `--max-per-mint <n>` - Maximum tokens per mint transaction (default: 20)
- `--skip-verify` - Skip contract verification on block explorer

</details>
<br>

### Available Networks

#### EVM Networks
- **Testnets**: sepolia, amoy, baseSepolia, bscTestnet
- **Mainnets**: mainnet, polygon, base, bsc

#### Solana Networks 
- **Networks**: solana-devnet, solana-testnet, solana

## Examples

### Same Network Copy

```bash
npm run copymint -- 0x123456... --level 2 --max-copy-count 10
```

### Cross-Network Copy

```bash
npm run copymint -- 0x123456... \
  --source-chain mainnet \
  --target-chain polygon \
  --level 3 \
  --max-copy-count 100 \
  --mint-count 5
```

## Deployment Records

Deployment information is automatically saved to:

```bash
deployments/<network>-<NFTname>-<timestamp>.json
```
