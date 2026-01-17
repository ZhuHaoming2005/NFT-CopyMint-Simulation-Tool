/**
 * Solana-specific CopyMint Orchestrator using Metaplex JS SDK
 * Handles NFT creation directly using Metaplex Token Metadata standard
 */

import { 
  createNft,
  mplTokenMetadata 
} from "@metaplex-foundation/mpl-token-metadata";
import {
  generateSigner,
  percentAmount,
  keypairIdentity,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import bs58 from 'bs58';
import { IPFSService } from '../shared/ipfs';
import { 
  BaseCopyMintConfig, 
  SourceNFTInfo, 
  ICopyMintOrchestrator 
} from '../shared/types';

const fs = require("fs");
const path = require("path");

export class SolanaCopyMintOrchestrator implements ICopyMintOrchestrator {
  private ipfsService: IPFSService;
  private umi: any = null;
  private mintedCount: number = 0;
  private baseURI: string = '';
  private collectionName: string = '';
  private contractAddress: Map<string,string>;
  private symbol: string = '';

  constructor() {
    this.ipfsService = new IPFSService();
    this.contractAddress = new Map<string,string>()
  }

  /**
   * Map network name to cluster display name
   */
  private getClusterName(networkName: string): string {
    switch (networkName) {
      case 'solana-devnet':
        return 'devnet';
      case 'solana-testnet':
        return 'testnet';
      case 'solana':
      case 'solana-mainnet':
        return 'mainnet-beta';
      default:
        return 'devnet';
    }
  }

  /**
   * Initialize Umi with wallet and network
   */
  private async initializeUmi(networkName: string) {
    if (this.umi) {
      return this.umi;
    }

    // Map network name to RPC endpoint
    let endpoint: string;
    
    switch (networkName) {
      case 'solana-devnet':
        endpoint = 'https://api.devnet.solana.com';
        break;
      case 'solana-testnet':
        endpoint = 'https://api.testnet.solana.com';
        break;
      case 'solana':
      case 'solana-mainnet':
        endpoint = 'https://api.mainnet-beta.solana.com';
        break;
      default:
        throw new Error(`Unsupported Solana network: ${networkName}`);
    }

    console.log(`\nConnecting to Solana ${this.getClusterName(networkName)}...`);
    console.log(`RPC Endpoint: ${endpoint}`);

    const umi = createUmi(endpoint)
      .use(mplTokenMetadata());

    // Load wallet from environment
    const privateKeyEnv = process.env.SOLANA_PRIVATE_KEY;
    if (!privateKeyEnv) {
      throw new Error('SOLANA_PRIVATE_KEY environment variable is required');
    }

    let secretKey: Uint8Array;
    try {
      // Try parsing as JSON array: [1,2,3,...]
      const privateKeyArray = JSON.parse(privateKeyEnv);
      secretKey = new Uint8Array(privateKeyArray);
    } catch {
      // Try as base58 string
      secretKey = bs58.decode(privateKeyEnv);
    }

    // Create Umi keypair from secret key
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
    umi.use(keypairIdentity(umiKeypair));

    console.log(`\nUmi initialized on ${networkName}`);
    console.log(`Wallet: ${umi.identity.publicKey}`);

    this.umi = umi;
    return umi;
  }

  /**
   * Validate networks
   */
  validateNetworks(targetChain: string): void {
    const supportedNetworks = ['solana-devnet', 'solana-testnet', 'solana', 'solana-mainnet'];
    if (!supportedNetworks.includes(targetChain)) {
      throw new Error(`Unsupported Solana network: ${targetChain}\nSupported: ${supportedNetworks.join(', ')}`);
    }
  }

  /**
   * Get NFT information (for Solana source, not implemented yet)
   */
  async getSourceNFTInfo(_contractAddress: string, _networkName: string): Promise<SourceNFTInfo> {
    throw new Error('Solana as source chain not yet implemented. Please use EVM as source.');
  }

  /**
   * Process CopyMint based on level
   */
  async processCopyMint(
    sourceInfo: SourceNFTInfo,
    config: BaseCopyMintConfig
  ): Promise<string> {
    console.log(`Processing CopyMint Level ${config.level}...`);

    const newBaseURI = await this.ipfsService.processCopyMint(
      config.level,
      config.sourceContract,
      sourceInfo.totalSupply,
      sourceInfo.baseURI,
      config.maxCopyCount
    );

    return newBaseURI;
  }

  /**
   * Skip Deploying Contract on Solana
   */
  async deployCopyMintContract(
    name: string,
    symbol: string,
    baseURI: string,
    _maxElements: number,
    _maxPerMint: number,
    networkName: string
  ): Promise<string> {
    console.log('\n========== Solana NFT Deploy ===============');
    console.log(`Skip Deploying Contract on Solana`);
    console.log(`============================================\n`);

    await this.initializeUmi(networkName);

    // Store collection info for minting
    this.baseURI = baseURI;
    this.collectionName = name;
    this.symbol = symbol;
    this.mintedCount = 0;

    return '';
  }

  /**
   * Mint NFTs in the collection
   * Each NFT gets its own metadata URI = baseURI + tokenId
   */
  async mintTokens(_collectionAddress: string, count: number, networkName: string): Promise<void> {
    console.log(`\n========== Minting ${count} NFTs ==========`);

    if (!this.umi) {
      await this.initializeUmi(networkName);
    }

    const umi = this.umi;

    if (!this.baseURI) {
      throw new Error('Base URI not set. Call deployCopyMintContract first.');
    }

    console.log(`Base URI: ${this.baseURI}`);
    console.log(`Starting Token ID: ${this.mintedCount}\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < count; i++) {
      const tokenId = this.mintedCount;

      try {
        // Generate signer for this NFT
        const nftMint = generateSigner(umi);

        // Generate token URI: baseURI + tokenId
        let tokenUri = `${this.baseURI}${tokenId}`;
        const tokenName = `${this.collectionName} #${tokenId}`;

        if (tokenUri.startsWith('ipfs://')) {
          tokenUri = tokenUri.replace('ipfs/', '');
          tokenUri = tokenUri.replace('ipfs://', 'https://ipfs.io/ipfs/');
        }

        console.log(`[${i + 1}/${count}] Minting NFT #${tokenId}...`);

        // Create the NFT and link it to the collection
        await createNft(umi, {
          mint: nftMint,
          name: tokenName,
          symbol: this.symbol,
          uri: tokenUri,
          sellerFeeBasisPoints: percentAmount(100),
        }).sendAndConfirm(umi);

        this.contractAddress.set(tokenName, nftMint.publicKey.toString());

        console.log(`NFT created: ${nftMint.publicKey}`);

        successCount++;
        this.mintedCount++;
      } catch (error: any) {
        console.error(`  Failed to mint NFT #${tokenId}:`, error.message);
        failCount++;
      }
    }

    console.log(`\n========== Minting Summary ==========`);
    console.log(`Total Attempted: ${count}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Total Minted in Collection: ${this.mintedCount}`);
    console.log(`=====================================\n`);
  }

  /**
   * Verify "contract" - On Solana, verification is automatic (on-chain data)
   */
  async verifyContract(
    _contractAddress: string,
    _name: string,
    _symbol: string,
    _baseURI: string,
    _maxElements: number,
    _maxPerMint: number,
    _networkName: string
  ): Promise<void> {
    
    console.log('\n========== Solana NFT Verification ==========');
    console.log('Solana NFTs are automatically verifiable on-chain');
    console.log(`============================================\n`);
  }

  /**
   * Record deployment information
   */
  recordDeploymentInfo(
    config: BaseCopyMintConfig,
    sourceInfo: SourceNFTInfo,
    _contractAddress: string,
    newBaseURI: string,
    networkName: string
  ): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const sanitizedName = sourceInfo.name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${networkName}-${sanitizedName}-${timestamp}.json`;
    const cluster = this.getClusterName(networkName);

    const deploymentInfo = {
      timestamp: new Date().toISOString(),
      network: networkName,
      cluster: cluster,
      ecosystem: 'Solana',
      type: 'Metaplex NFT',
      source: {
        contract: config.sourceContract,
        network: config.sourceChain,
        name: sourceInfo.name,
        symbol: sourceInfo.symbol,
        totalSupply: sourceInfo.totalSupply,
        baseURI: sourceInfo.baseURI
      },
      target: {
        collectionAddress: Object.fromEntries(this.contractAddress),
        network: config.targetChain,
        cluster: cluster,
        name: sourceInfo.name,
        symbol: sourceInfo.symbol,
        newBaseURI: newBaseURI,
        maxElements: sourceInfo.totalSupply,
        mintedTokens: config.mintCount
      },
      copyMint: {
        level: config.level,
        maxCopyCount: config.maxCopyCount || 'all',
        verificationSkipped: config.skipVerify || false
      }
    };

    // Ensure deployments directory exists
    const deploymentsDir = path.join(process.cwd(), 'deployments');

    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const filePath = path.join(deploymentsDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));

    console.log(`\nDeployment info saved to: ${filePath}`);
  }
}
