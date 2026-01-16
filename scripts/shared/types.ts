/**
 * Shared types and enums for cross-chain NFT copying
 */

/**
 * NFT metadata structure following OpenSea standard
 */
export interface NFTMetadata {
  uri?: string;
  name?: string;
  description?: string;
  image?: string;
  data?: {
    url?: string;
  };
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  [key: string]: any;
}

/**
 * CopyMint levels defining the degree of copying
 */
export enum CopyMintLevel {
  LEVEL_1 = 1, // Direct baseURI copy
  LEVEL_2 = 2, // Re-upload metadata JSON to IPFS
  LEVEL_3 = 3  // Re-upload images and modify metadata
}

/**
 * Base configuration for CopyMint operation
 */
export interface BaseCopyMintConfig {
  // Source configuration
  sourceChain: string;
  sourceContract: string;

  // Target configuration
  targetChain: string;

  // CopyMint configuration
  level: CopyMintLevel;
  maxPerMint: number;
  mintCount: number;

  // Optional: maximum number of tokens to copy for Level 2/3 (for debugging)
  maxCopyCount?: number;

  // Optional: skip contract verification
  skipVerify?: boolean;
}

/**
 * Source NFT information
 */
export interface SourceNFTInfo {
  name: string;
  symbol: string;
  totalSupply: number;
  baseURI: string;
}

/**
 * CopyMint execution result
 */
export interface CopyMintResult {
  deployedContract: string;
  newBaseURI: string;
}

/**
 * Orchestrator interface for different blockchain ecosystems
 * The main execution logic is in copyMint.ts and calls these methods
 */
export interface ICopyMintOrchestrator {
  /**
   * Get NFT information from source contract
   */
  getSourceNFTInfo(contractAddress: string, networkName: string): Promise<SourceNFTInfo>;

  /**
   * Deploy CopyMint contract on target network
   */
  deployCopyMintContract(
    name: string,
    symbol: string,
    baseURI: string,
    maxElements: number,
    maxPerMint: number,
    networkName: string
  ): Promise<string>;

  /**
   * Mint tokens in the CopyMint contract
   */
  mintTokens(contractAddress: string, count: number, networkName: string): Promise<void>;

  /**
   * Verify contract on block explorer
   */
  verifyContract(
    contractAddress: string,
    name: string,
    symbol: string,
    baseURI: string,
    maxElements: number,
    maxPerMint: number,
    networkName: string
  ): Promise<void>;
}
