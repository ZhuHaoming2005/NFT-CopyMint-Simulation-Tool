#!/usr/bin/env ts-node

/**
 * Cross-chain NFT CopyMint Entry Point
 * Supports multiple blockchain ecosystems (EVM, Solana, etc.)
 */

import { CopyMintLevel, BaseCopyMintConfig, CopyMintResult, ICopyMintOrchestrator } from './shared/types';
import { EVMCopyMintOrchestrator } from './evm/evmOrchestrator';

/**
 * Determine blockchain ecosystem based on network name
 */
function getEcosystemType(networkName: string): 'evm' | 'solana' {
  const evmNetworks = ['sepolia', 'amoy', 'baseSepolia', 'bscTestnet', 'mainnet', 'polygon', 'base', 'bsc'];
  const solanaNetworks = ['solana-devnet', 'solana-testnet', 'solana'];

  if (evmNetworks.includes(networkName)) {
    return 'evm';
  } else if (solanaNetworks.includes(networkName)) {
    return 'solana';
  }

  // Default to EVM for unknown networks
  console.warn(`Unknown network '${networkName}', defaulting to EVM ecosystem`);
  return 'evm';
  }

  /**
 * Main CopyMint execution function
 * Orchestrates the entire CopyMint process across different ecosystems
 * @param sourceOrchestrator - Orchestrator for reading source NFT info
 * @param targetOrchestrator - Orchestrator for deploying on target network
 */
async function executeCopyMint(
  sourceOrchestrator: ICopyMintOrchestrator,
  targetOrchestrator: ICopyMintOrchestrator,
  config: BaseCopyMintConfig
): Promise<CopyMintResult> {
  console.log('========== Starting CopyMint Process ==========');

  // Step 1: Validate networks (ecosystem-specific)
  if ('validateNetworks' in targetOrchestrator) {
    (targetOrchestrator as any).validateNetworks(config.targetChain);
  }

  if ('validateNetworks' in sourceOrchestrator) {
    (sourceOrchestrator as any).validateNetworks(config.sourceChain);
  }

    console.log(`Source: ${config.sourceChain} - ${config.sourceContract}`);
    console.log(`Target: ${config.targetChain}`);
    console.log(`Level: ${config.level}`);

  // Step 2: Get source NFT information from source network using source orchestrator
  const sourceInfo = await sourceOrchestrator.getSourceNFTInfo(config.sourceContract, config.sourceChain);
    console.log('Source NFT Info:');
    console.log(`  Name: ${sourceInfo.name}`);
    console.log(`  Symbol: ${sourceInfo.symbol}`);
    console.log(`  Total Supply: ${sourceInfo.totalSupply}`);
    console.log(`  Base URI: ${sourceInfo.baseURI}`);
  console.log(`  Network: ${config.sourceChain}`);

  // Step 3: Process CopyMint based on level
  let newBaseURI: string;
  if ('processCopyMint' in targetOrchestrator) {
    newBaseURI = await (targetOrchestrator as any).processCopyMint(sourceInfo, config);
  } else {
    throw new Error('Target orchestrator does not support processCopyMint');
  }

  // Step 4: Deploy CopyMint contract on target network using target orchestrator
  const contractAddress = await targetOrchestrator.deployCopyMintContract(
    sourceInfo.name,
    sourceInfo.symbol,
    newBaseURI,
    sourceInfo.totalSupply,
    config.maxPerMint,
    config.targetChain
  );

  // Step 5: Verify contract on target network block explorer (unless skipped)
  if (!config.skipVerify) {
    await targetOrchestrator.verifyContract(
      contractAddress,
      sourceInfo.name,
      sourceInfo.symbol,
      newBaseURI,
      sourceInfo.totalSupply,
      config.maxPerMint,
      config.targetChain
    );
  } else {
    console.log('\nSkipping contract verification (--skip-verify flag set)');
  }

  // Step 6: Mint tokens on target network using target orchestrator
  await targetOrchestrator.mintTokens(contractAddress, config.mintCount, config.targetChain);

  // Step 7: Record deployment information (ecosystem-specific)
  if ('recordDeploymentInfo' in targetOrchestrator) {
    (targetOrchestrator as any).recordDeploymentInfo(config, sourceInfo, contractAddress, newBaseURI, config.targetChain);
  }

  console.log('========== CopyMint Process Complete ==========');
    console.log(`Deployed Contract: ${contractAddress}`);
    console.log(`New Base URI: ${newBaseURI}`);
  console.log(`Deployment info saved to: deployments/${config.targetChain}-${sourceInfo.name.replace(/[^a-zA-Z0-9]/g, '_')}-*.json`);

    return {
      deployedContract: contractAddress,
      newBaseURI
    };
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: npm run copymint -- <sourceContract> [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  sourceContract    Source NFT contract address');
    console.log('');
    console.log('Options:');
    console.log('  --level <1|2|3>   CopyMint level (default: 1)');
    console.log('  --max-per-mint <n> Max tokens per mint (default: 20)');
    console.log('  --max-copy-count <n> Max tokens to copy for Level 2/3 (default: all, for debugging)');
    console.log('  --mint-count <n> Number of tokens to mint (default: 1)');
    console.log('  --skip-verify    Skip contract verification on block explorer');
    console.log('  --source-chain <chain> Source chain name (default: sepolia)');
    console.log('  --target-chain <chain> Target chain name (default: sepolia)');
    console.log('');
    console.log('Available Networks:');
    console.log('  EVM:');
    console.log('    sepolia, amoy, baseSepolia, bscTestnet (testnets)');
    console.log('    mainnet, polygon, base, bsc (mainnets)');
    console.log('  Solana (coming soon):');
    console.log('    solana-devnet, solana-testnet, solana-mainnet');
    console.log('');
    console.log('CopyMint Levels:');
    console.log('  1: Direct baseURI copy');
    console.log('  2: Re-upload metadata JSON files to IPFS');
    console.log('  3: Re-upload images and modify metadata');
    process.exit(1);
  }

  const sourceContract = args[0];

  // Parse command line arguments
  const config: BaseCopyMintConfig = {
    sourceChain: 'sepolia',
    sourceContract,
    targetChain: 'sepolia',
    level: CopyMintLevel.LEVEL_1,
    maxPerMint: 20,
    mintCount: 1
  };

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--level':
        config.level = parseInt(args[++i]) as CopyMintLevel;
        break;
      case '--max-per-mint':
        config.maxPerMint = parseInt(args[++i]);
        break;
      case '--max-copy-count':
        config.maxCopyCount = parseInt(args[++i]);
        break;
      case '--mint-count':
        config.mintCount = parseInt(args[++i]);
        break;
      case '--skip-verify':
        config.skipVerify = true;
        break;
      case '--source-chain':
        config.sourceChain = args[++i];
        break;
      case '--target-chain':
        config.targetChain = args[++i];
        break;
    }
  }

  try {
    // Determine ecosystem for both source and target chains
    const sourceEcosystem = getEcosystemType(config.sourceChain);
    const targetEcosystem = getEcosystemType(config.targetChain);

    console.log(`\n========== CopyMint Configuration ==========`);
    console.log(`Source Chain: ${config.sourceChain}`);
    console.log(`Target Chain: ${config.targetChain}`);
    console.log(`CopyMint Level: ${config.level}`);
    console.log(`==========================================\n`);

    // Create orchestrators for source and target chains
    let sourceOrchestrator: ICopyMintOrchestrator;
    let targetOrchestrator: ICopyMintOrchestrator;

    // Initialize source orchestrator
    if (sourceEcosystem === 'evm') {
      sourceOrchestrator = new EVMCopyMintOrchestrator();
    } else if (sourceEcosystem === 'solana') {
      throw new Error(`Unsupported source ecosystem: ${sourceEcosystem}`);
    } else {
      throw new Error(`Unsupported source ecosystem: ${sourceEcosystem}`);
    }

    // Initialize target orchestrator
    if (targetEcosystem === 'evm') {
      targetOrchestrator = new EVMCopyMintOrchestrator();
    } else if (targetEcosystem === 'solana') {
      throw new Error(`Unsupported source ecosystem: ${sourceEcosystem}`);
    } else {
      throw new Error(`Unsupported target ecosystem: ${targetEcosystem}`);
    }

    // Execute CopyMint with both orchestrators
    const result = await executeCopyMint(sourceOrchestrator, targetOrchestrator, config);

    console.log('\n========== CopyMint Summary ==========');
    console.log(`Source Contract: ${config.sourceContract}`);
    console.log(`Source Chain: ${config.sourceChain}`);
    console.log(`Target Chain: ${config.targetChain}`);
    console.log(`CopyMint Level: ${config.level}`);
    console.log(`Deployed Contract: ${result.deployedContract}`);
    console.log(`New Base URI: ${result.newBaseURI}`);
    console.log(`=======================================\n`);

  } catch (error) {
    console.error('CopyMint failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { main };
