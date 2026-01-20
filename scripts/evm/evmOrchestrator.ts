/**
 * EVM-specific CopyMint Orchestrator
 * Handles all EVM blockchain operations including contract deployment and verification
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
import { IPFSService } from '../shared/ipfs';
import { 
  BaseCopyMintConfig, 
  SourceNFTInfo, 
  ICopyMintOrchestrator 
} from '../shared/types';
import { CopyMintNFT__factory } from '../../typechain-types';

export class EVMCopyMintOrchestrator implements ICopyMintOrchestrator {
  private ipfsService: IPFSService;
  private networkProviders: Map<string, any> = new Map();

  constructor() {
    this.ipfsService = new IPFSService();
  }

  /**
   * Validate that the specified networks are configured
   */
  validateNetworks(targetChain: string): void {
    const availableNetworks = Object.keys(hre.config.networks);

    if (!availableNetworks.includes(targetChain)) {
      throw new Error(`Target network '${targetChain}' is not configured in hardhat.config.ts\nAvailable networks: ${availableNetworks.join(', ')}`);
    }
  }

  /**
   * Get or create network provider for a specific network
   */
  private async getNetworkProvider(networkName: string) {
    if (this.networkProviders.has(networkName)) {
      return this.networkProviders.get(networkName);
    }

    // Create provider for the specified network
    const networkConfig = hre.config.networks[networkName];
    if (!networkConfig) {
      throw new Error(`Network '${networkName}' not found in hardhat config`);
    }

    const provider = new hre.ethers.JsonRpcProvider(networkConfig.url);
    this.networkProviders.set(networkName, provider);
    return provider;
  }

  /**
   * Get signer for a specific network
   */
  private async getNetworkSigner(networkName: string) {
    const provider = await this.getNetworkProvider(networkName);
    const privateKey = process.env.EVM_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('EVM_PRIVATE_KEY environment variable is required');
    }
    return new hre.ethers.Wallet(privateKey, provider);
  }

  /**
   * Get NFT information from source contract on specified network
   */
  async getSourceNFTInfo(contractAddress: string, networkName: string): Promise<SourceNFTInfo> {
    console.log(`Fetching NFT info from ${contractAddress} on network ${networkName}...`);

    const provider = await this.getNetworkProvider(networkName);

    // Create contract instance with the specific network provider
    const nftContract = new hre.ethers.Contract(
      contractAddress,
      [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function totalSupply() view returns (uint256)',
        'function baseURI() view returns (string)',
        'function tokenURI(uint256) view returns (string)'
      ],
      provider
    );

    console.log('Calling contract methods...');
    const [name, symbol, totalSupply, baseURI] = await Promise.all([
      nftContract.name().catch(() => 'Unknown NFT'),
      nftContract.symbol().catch(() => 'NFT'),
      this.getTotalSupply(contractAddress, networkName),
      this.getBaseURI(contractAddress, networkName)
    ]);

    return {
      name,
      symbol,
      totalSupply,
      baseURI
    };
  }

  /**
   * Get total supply from contract on specified network
   */
  private async getTotalSupply(contractAddress: string, networkName: string): Promise<number> {
    try {
      const provider = await this.getNetworkProvider(networkName);

      // Try ERC721Enumerable first
      const enumerableContract = new hre.ethers.Contract(
        contractAddress,
        ['function totalSupply() view returns (uint256)'],
        provider
      );
      const totalSupply = await enumerableContract.totalSupply();
      return Number(totalSupply);
    } catch (error) {
      console.warn('Contract does not support ERC721Enumerable, estimating total supply...');
      // If not enumerable, we'll need to estimate or get from user
      // For now, return a reasonable default
      return 10000;
    }
  }

  /**
   * Get base URI from contract on specified network
   * Tries multiple common function names: baseURI(), baseTokenURI(), or infers from tokenURI()
   */
  private async getBaseURI(contractAddress: string, networkName: string): Promise<string> {
    const provider = await this.getNetworkProvider(networkName);

    // Try baseURI() first
    try {
      const contract = new hre.ethers.Contract(
        contractAddress,
        ['function baseURI() view returns (string)'],
        provider
      );
      const baseURI = await contract.baseURI();
      if (baseURI && baseURI.length > 0) return baseURI;
    } catch {
      // Continue to next attempt
    }

    // Try baseTokenURI()
    try {
      const contract = new hre.ethers.Contract(
        contractAddress,
        ['function baseTokenURI() view returns (string)'],
        provider
      );
      const baseURI = await contract.baseTokenURI();
      if (baseURI && baseURI.length > 0) return baseURI;
    } catch {
      // Continue to next attempt
    }

    // Try to infer from tokenURI(0)
    try {
      const contract = new hre.ethers.Contract(
        contractAddress,
        ['function tokenURI(uint256 tokenId) view returns (string)'],
        provider
      );
      const tokenURI = await contract.tokenURI(0);
      // Extract baseURI by removing the token ID suffix
      // e.g., "ipfs://QmXXX/0" -> "ipfs://QmXXX/"
      const lastSlashIndex = tokenURI.lastIndexOf('/');
      if (lastSlashIndex !== -1) {
        return tokenURI.substring(0, lastSlashIndex + 1);
      }
      return tokenURI;
    } catch {
      // Continue to next attempt
    }

    throw new Error('Failed to get baseURI from contract. Tried: baseURI(), baseTokenURI(), tokenURI(0)');
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
   * Deploy CopyMint contract on specified network
   */
  async deployCopyMintContract(
    name: string,
    symbol: string,
    baseURI: string,
    maxElements: number,
    maxPerMint: number,
    networkName: string
  ): Promise<string> {
    console.log(`Deploying CopyMintNFT contract on ${networkName}...`);

    // Get signer for the target network
    const signer = await this.getNetworkSigner(networkName);

    // Create contract factory with the signer
    const CopyMintNFT = await hre.ethers.getContractFactory('CopyMintNFT', signer);
    const contract = await CopyMintNFT.deploy(name, symbol, baseURI, maxElements, maxPerMint);

    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();

    console.log(`CopyMintNFT deployed at: ${contractAddress} on ${networkName}`);
    return contractAddress;
  }

  /**
   * Verify contract on block explorer for specified network
   */
  async verifyContract(
    contractAddress: string,
    name: string,
    symbol: string,
    baseURI: string,
    maxElements: number,
    maxPerMint: number,
    networkName: string
  ): Promise<void> {
    console.log(`\n========== Verifying Contract on Block Explorer (${networkName}) ==========`);
    console.log(`Contract Address: ${contractAddress}`);

    try {
      console.log('Starting verification...');

      // Use execSync for simpler command execution
      const { execSync } = require('child_process');

      const command = `npx hardhat verify --network ${networkName} ${contractAddress} "${name}" "${symbol}" "${baseURI}" ${maxElements} ${maxPerMint}`;

      console.log(`Executing: ${command}`);

      try {
        execSync(command, {
          stdio: 'inherit',
          cwd: process.cwd(),
          env: { ...process.env, FORCE_COLOR: '1' }
        });
      } catch (error: any) {
        // execSync throws error with exit code, but we handle it in the outer catch
        throw new Error(`Verification process failed: ${error.message}`);
      }

      console.log('Contract verified successfully!');
    } catch (error: any) {
      if (error.message.includes('Already Verified')) {
        console.log('Contract is already verified!');
      } else {
        console.error('Verification failed:', error.message);
        console.log('You can manually verify using:');
        console.log(`npx hardhat verify --network ${networkName} ${contractAddress} "${name}" "${symbol}" "${baseURI}" ${maxElements} ${maxPerMint}`);
      }
    }
  }

  /**
   * Mint tokens in the CopyMint contract on specified network
   */
  async mintTokens(contractAddress: string, Count: number, networkName: string): Promise<void> {
    console.log(`Minting ${Count} tokens on ${networkName}...`);

    // Get signer for the target network
    const signer = await this.getNetworkSigner(networkName);

    const contract = CopyMintNFT__factory.connect(contractAddress, signer);

    // Mint tokens in batches to avoid gas limits
    const batchSize = Count > 1 ? Count : 1;

    try {
      const tx = await contract.mint(signer.address, batchSize);
      await tx.wait();
      console.log(`Successfully minted ${batchSize} tokens on ${networkName}`);
    } catch (error) {
      console.error(`Failed to mint tokens on ${networkName}:`, error);
      throw error;
    }
  }

  /**
   * Record deployment information to a file
   */
  recordDeploymentInfo(
    config: BaseCopyMintConfig,
    sourceInfo: SourceNFTInfo,
    contractAddress: string,
    newBaseURI: string,
    networkName: string
  ): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const sanitizedName = sourceInfo.name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${networkName}-${sanitizedName}-${timestamp}.json`;

    const deploymentInfo = {
      timestamp: new Date().toISOString(),
      network: networkName,
      ecosystem: 'EVM',
      source: {
        contract: config.sourceContract,
        network: config.sourceChain,
        name: sourceInfo.name,
        symbol: sourceInfo.symbol,
        totalSupply: sourceInfo.totalSupply,
        baseURI: sourceInfo.baseURI
      },
      target: {
        contract: contractAddress,
        network: config.targetChain,
        name: sourceInfo.name,
        symbol: sourceInfo.symbol,
        newBaseURI: newBaseURI,
        maxElements: sourceInfo.totalSupply,
        maxPerMint: config.maxPerMint,
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
