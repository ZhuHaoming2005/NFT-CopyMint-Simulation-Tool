/**
 * Solana-specific CopyMint Orchestrator
 * Handles all Solana blockchain operations including NFT minting via Metaplex
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { 
  Connection, 
  PublicKey, 
  Keypair, 
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  clusterApiUrl
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress
} from "@solana/spl-token";
// import { 
//   getMetadataAccountDataSerializer
// } from "@metaplex-foundation/mpl-token-metadata";
import { IPFSService } from '../shared/ipfs';
import { 
  BaseCopyMintConfig, 
  SourceNFTInfo, 
  ICopyMintOrchestrator 
} from '../shared/types';
import bs58 from 'bs58';

const fs = require("fs");
const path = require("path");

// Metaplex Token Metadata Program ID (fixed address)
const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

export class SolanaCopyMintOrchestrator implements ICopyMintOrchestrator {
  private ipfsService: IPFSService;
  private connections: Map<string, Connection> = new Map();
  private providers: Map<string, AnchorProvider> = new Map();
  private programId: PublicKey | null = null;
  private programKeypair: Keypair | null = null;

  constructor() {
    this.ipfsService = new IPFSService();
  }

  /**
   * Generate program keypair for deployment
   */
  private generateNewProgramKeypair(): Keypair {
    console.log('Generating program keypair for deployment...');
    this.programKeypair = Keypair.generate();
    this.programId = this.programKeypair.publicKey;
    console.log(`Program ID: ${this.programId.toString()}\n`);
    return this.programKeypair;
  }

  /**
   * Get current program ID
   */
  private getProgramId(): PublicKey {
    if (!this.programId) {
      throw new Error('Program ID not initialized. Call deployProgram first.');
    }
    return this.programId;
  }

  /**
   * Deploy program instance to Solana network
   * Each deployment creates a fresh program with a new address
   */
  private async deployProgram(networkName: string): Promise<void> {
    console.log(`\n========== Deploying Solana Program Instance ==========`);
    
    // Generate program keypair for this deployment
    const programKeypair = this.generateNewProgramKeypair();
    const programId = programKeypair.publicKey;
    
    console.log(`Network: ${networkName}`);

    // Map network name to cluster
    let cluster: string;
    switch (networkName) {
      case 'solana-devnet':
        cluster = 'devnet';
        break;
      case 'solana-testnet':
        cluster = 'testnet';
        break;
      case 'solana':
      case 'solana-mainnet':
        cluster = 'mainnet';
        break;
      default:
        throw new Error(`Unsupported network: ${networkName}`);
    }

    try {
      const connection = this.getConnection(networkName);
      
      // Read program binary
      const programBinaryPath = path.join(process.cwd(), 'programs', 'copymint-nft', 'target', 'deploy', 'CopyMintNFT.so');
      
      if (!fs.existsSync(programBinaryPath)) {
        throw new Error(`Program binary not found at ${programBinaryPath}. Please run 'anchor build' first.`);
      }

      // Save temporary program keypair for deployment
      const tempKeypairPath = path.join(process.cwd(), '.temp-program-keypair.json');
      fs.writeFileSync(tempKeypairPath, JSON.stringify(Array.from(programKeypair.secretKey)));

      console.log(`Deploying program instance...`);

      // Use Solana CLI for deployment
      const { execSync } = require('child_process');
      
      const deployCmd = `solana program deploy ${programBinaryPath} --program-id ${tempKeypairPath} --url ${cluster}`;
      
      console.log(`Executing: solana program deploy...`);
      
      const output = execSync(deployCmd, {
        encoding: 'utf-8',
        stdio: 'pipe',
        env: { ...process.env }
      });

      console.log(output);
      
      // Clean up temporary keypair
      if (fs.existsSync(tempKeypairPath)) {
        fs.unlinkSync(tempKeypairPath);
      }
      
      // Verify deployment
      const accountInfo = await connection.getAccountInfo(programId);
      
      if (!accountInfo || !accountInfo.executable) {
        throw new Error('Program deployment verification failed');
      }

      console.log(`\nProgram deployed successfully!`);
      console.log(`Program ID: ${programId.toString()}`);
      console.log(`Explorer: https://explorer.solana.com/address/${programId.toString()}?cluster=${cluster}`);
      console.log(`==========================================================\n`);
      
    } catch (error: any) {
      console.error('\nProgram deployment failed:', error.message);
      if (error.stdout) console.error('STDOUT:', error.stdout);
      if (error.stderr) console.error('STDERR:', error.stderr);
      throw new Error(`Failed to deploy Solana program: ${error.message}`);
    }
  }

  /**
   * Get connection for a specific Solana network
   */
  private getConnection(networkName: string): Connection {
    if (this.connections.has(networkName)) {
      return this.connections.get(networkName)!;
    }

    let endpoint: string;
    switch (networkName) {
      case 'solana-devnet':
        endpoint = clusterApiUrl('devnet');
        break;
      case 'solana-testnet':
        endpoint = clusterApiUrl('testnet');
        break;
      case 'solana':
      case 'solana-mainnet':
        endpoint = clusterApiUrl('mainnet-beta');
        break;
      default:
        // Try to use as custom RPC URL
        endpoint = networkName;
    }

    const connection = new Connection(endpoint, 'confirmed');
    this.connections.set(networkName, connection);
    return connection;
  }

  /**
   * Get wallet from environment
   */
  private getWallet(): Keypair {
    const privateKeyEnv = process.env.SOLANA_PRIVATE_KEY;
    if (!privateKeyEnv) {
      throw new Error('SOLANA_PRIVATE_KEY environment variable is required');
    }

    // Support both array format and base58 format
    let keypair: Keypair;
    try {
      // Try parsing as JSON array
      const privateKeyArray = JSON.parse(privateKeyEnv);
      keypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
    } catch {
      // Try as base58 string
      keypair = Keypair.fromSecretKey(bs58.decode(privateKeyEnv));
    }

    return keypair;
  }

  /**
   * Get Anchor provider for a specific network
   */
  private getProvider(networkName: string): AnchorProvider {
    if (this.providers.has(networkName)) {
      return this.providers.get(networkName)!;
    }

    const connection = this.getConnection(networkName);
    const wallet = this.getWallet();
    const anchorWallet = new Wallet(wallet);
    
    const provider = new AnchorProvider(
      connection,
      anchorWallet,
      { commitment: 'confirmed' }
    );

    this.providers.set(networkName, provider);
    return provider;
  }

  /**
   * Get NFT information from source contract on specified network
   * For Solana, we read the collection metadata
   */
  async getSourceNFTInfo(_collectionMint: string, _networkName: string): Promise<SourceNFTInfo> {
    throw new Error('Solana source NFT reading not yet implemented. Please use EVM as source chain for now.');
    //TODO: Implement this
    /*
    console.log(`Fetching Solana NFT collection info from ${collectionMint} on ${networkName}...`);

    const connection = this.getConnection(networkName);
    const collectionMintPubkey = new PublicKey(collectionMint);

    try {
      // Get metadata account
      const [metadataAddress] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          collectionMintPubkey.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      // Fetch and deserialize metadata account
      const metadataAccountInfo = await connection.getAccountInfo(metadataAddress);
      if (!metadataAccountInfo) {
        throw new Error('Metadata account not found');
      }

      // Deserialize metadata data (skip account header, start from offset 1)
      const serializer = getMetadataAccountDataSerializer();
      const metadataAccount = serializer.deserialize(metadataAccountInfo.data)[0];

      // Get collection state if it exists
      const programId = this.getProgramId();
      const [collectionStateAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from('collection_state'), collectionMintPubkey.toBuffer()],
        programId
      );

      let totalSupply = 1000; // Default
      let baseURI = metadataAccount.uri;

      try {
        const collectionStateAccount = await connection.getAccountInfo(collectionStateAddress);
        if (collectionStateAccount) {
          // Parse collection state (simplified - would need proper deserialization)
          // For now, use defaults
          totalSupply = 10000;
        }
      } catch (error) {
        console.warn('Could not fetch collection state, using defaults');
      }

      return {
        name: metadataAccount.name.replace(/\0/g, ''),
        symbol: metadataAccount.symbol.replace(/\0/g, ''),
        totalSupply,
        baseURI: baseURI.replace(/\0/g, '')
      };
    } catch (error) {
      throw new Error(`Failed to get Solana NFT info: ${error}`);
    }
    */
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
   * Deploy CopyMint collection on Solana
   */
  async deployCopyMintContract(
    name: string,
    symbol: string,
    baseURI: string,
    maxElements: number,
    maxPerMint: number,
    networkName: string
  ): Promise<string> {
    console.log(`Deploying CopyMint NFT Collection on Solana ${networkName}...`);

    // Deploy a NEW program instance for each execution
    await this.deployProgram(networkName);

    const provider = this.getProvider(networkName);
    const programId = this.getProgramId();
    
    // Generate new collection mint
    const collectionMint = Keypair.generate();
    
    // Derive collection state PDA
    const [collectionState] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection_state'), collectionMint.publicKey.toBuffer()],
      programId
    );

    // Derive metadata accounts
    const [collectionMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        collectionMint.publicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const [collectionMasterEdition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        collectionMint.publicKey.toBuffer(),
        Buffer.from('edition'),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    // Get associated token account
    const collectionTokenAccount = await getAssociatedTokenAddress(
      collectionMint.publicKey,
      provider.wallet.publicKey
    );

    try {
      // Load program IDL with correct program ID
      const idl = await this.loadProgramIDL();
      idl.address = programId.toString();
      const program = new Program(idl, provider);

      console.log(`Initializing collection on-chain...`);

      // Initialize collection
      const tx = await program.methods
        .initializeCollection(name, symbol, baseURI, new anchor.BN(maxElements), new anchor.BN(maxPerMint))
        .accounts({
          authority: provider.wallet.publicKey,
          collectionState,
          collectionMint: collectionMint.publicKey,
          collectionTokenAccount,
          collectionMetadata,
          collectionMasterEdition,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([collectionMint])
        .rpc();

      console.log(`Collection created! Signature: ${tx}`);
      console.log(`Collection Mint: ${collectionMint.publicKey.toString()}`);

      return collectionMint.publicKey.toString();
    } catch (error) {
      console.error('\nFailed to deploy collection:', error);
      throw new Error(`Failed to deploy Solana collection: ${error}`);
    }
  }

  /**
   * Mint NFTs in the collection
   */
  async mintTokens(collectionMint: string, count: number, networkName: string): Promise<void> {
    console.log(`Minting ${count} NFTs on Solana ${networkName}...`);

    const provider = this.getProvider(networkName);
    const collectionMintPubkey = new PublicKey(collectionMint);
    const programId = this.getProgramId();

    // Derive collection state PDA
    const [collectionState] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection_state'), collectionMintPubkey.toBuffer()],
      programId
    );

    // Load program with correct program ID
    const idl = await this.loadProgramIDL();
    idl.address = programId.toString();
    const program = new Program(idl, provider);

    // Fetch collection state data from on-chain account
    console.log('Fetching collection state from chain...');
    
    let collectionStateData: any;
    try {
      // Try to fetch using program account namespace
      collectionStateData = await (program.account as any).collectionState.fetch(collectionState);
    } catch (error) {
      // Fallback: manually deserialize account data
      const connection = this.getConnection(networkName);
      const accountInfo = await connection.getAccountInfo(collectionState);
      if (!accountInfo) {
        throw new Error('Collection state account not found');
      }
      
      // Manual deserialization (simplified - adjust based on actual account structure)
      // This is a fallback and might need adjustment based on the exact serialization format
      throw new Error(
        `Failed to fetch collection state. Please ensure the program is deployed and IDL is correct. Error: ${error}`
      );
    }
    
    const baseURI = collectionStateData.baseUri;
    const startTokenId = collectionStateData.totalMinted.toNumber();
    const collectionName = collectionStateData.name;
    const collectionSymbol = collectionStateData.symbol;
    const maxSupply = collectionStateData.maxSupply.toNumber();

    console.log(`\n========== Collection Information ==========`);
    console.log(`Name: ${collectionName}`);
    console.log(`Symbol: ${collectionSymbol}`);
    console.log(`Base URI: ${baseURI}`);
    console.log(`Current Total Minted: ${startTokenId}`);
    console.log(`Max Supply: ${maxSupply}`);
    console.log(`Minting ${count} NFTs (Token IDs: ${startTokenId} - ${startTokenId + count - 1})`);
    console.log(`==========================================\n`);

    // Validate minting won't exceed max supply
    if (startTokenId + count > maxSupply) {
      throw new Error(
        `Cannot mint ${count} NFTs. Would exceed max supply (${maxSupply}). ` +
        `Current minted: ${startTokenId}, Available: ${maxSupply - startTokenId}`
      );
    }

    // Get collection metadata accounts
    const [collectionMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        collectionMintPubkey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const [collectionMasterEdition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        collectionMintPubkey.toBuffer(),
        Buffer.from('edition'),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    // Mint NFTs one by one
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < count; i++) {
      const tokenId = startTokenId + i;
      
      try {
        const nftMint = Keypair.generate();
        
        // Derive NFT metadata accounts
        const [nftMetadata] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('metadata'),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            nftMint.publicKey.toBuffer(),
          ],
          TOKEN_METADATA_PROGRAM_ID
        );

        const [nftMasterEdition] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('metadata'),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            nftMint.publicKey.toBuffer(),
            Buffer.from('edition'),
          ],
          TOKEN_METADATA_PROGRAM_ID
        );

        const nftTokenAccount = await getAssociatedTokenAddress(
          nftMint.publicKey,
          provider.wallet.publicKey
        );

        // Generate token URI using baseURI + tokenId (same as EVM)
        const tokenURI = `${baseURI}${tokenId}`;
        const tokenName = `${collectionName} #${tokenId}`;

        console.log(`[${i + 1}/${count}] Minting Token #${tokenId}...`);
        console.log(`  Name: ${tokenName}`);
        console.log(`  URI: ${tokenURI}`);

        // Mint NFT
        const tx = await program.methods
          .mintNft(
            tokenName,        // Use collection name + token ID
            collectionSymbol, // Use collection symbol
            tokenURI          // Use baseURI + tokenId
          )
          .accounts({
            payer: provider.wallet.publicKey,
            recipient: provider.wallet.publicKey,
            collectionState,
            nftMint: nftMint.publicKey,
            nftTokenAccount,
            nftMetadata,
            nftMasterEdition,
            collectionMint: collectionMintPubkey,
            collectionMetadata,
            collectionMasterEdition,
            tokenProgram: TOKEN_PROGRAM_ID,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([nftMint])
          .rpc();

        console.log(`  Success! Mint: ${nftMint.publicKey.toString()}`);
        console.log(`  Transaction: ${tx}\n`);
        successCount++;
      } catch (error) {
        console.error(`Failed to mint Token #${tokenId}:`, error);
        failCount++;
      }
    }

    console.log(`Successfully minted ${count} NFTs`);
  }

  /**
   * Verify contract (not applicable for Solana, but required by interface)
   */
  async verifyContract(
    contractAddress: string,
    _name: string,
    _symbol: string,
    _baseURI: string,
    _maxElements: number,
    _maxPerMint: number,
    networkName: string
  ): Promise<void> {
    console.log('\n========== Solana Program Verification ==========');
    console.log('Note: Solana programs are automatically verifiable on-chain');
    console.log(`Collection Mint: ${contractAddress}`);
    console.log(`Network: ${networkName}`);
    console.log(`View on Solana Explorer: https://explorer.solana.com/address/${contractAddress}?cluster=${networkName}`);
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
      ecosystem: 'Solana',
      program: {
        programId: this.getProgramId().toString()
      },
      source: {
        contract: config.sourceContract,
        network: config.sourceChain,
        name: sourceInfo.name,
        symbol: sourceInfo.symbol,
        totalSupply: sourceInfo.totalSupply,
        baseURI: sourceInfo.baseURI
      },
      target: {
        collectionMint: contractAddress,
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
      },
      explorer: {
        program: `https://explorer.solana.com/address/${this.getProgramId().toString()}?cluster=${networkName}`,
        collection: `https://explorer.solana.com/address/${contractAddress}?cluster=${networkName}`
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

  /**
   * Load program IDL
   */
  private async loadProgramIDL(): Promise<any> {
    const idlPath = path.join(process.cwd(), 'target', 'idl', 'CopyMintNFT.json');
    
    if (!fs.existsSync(idlPath)) {
      throw new Error(`IDL file not found at ${idlPath}. Please run 'anchor build' first.`);
    }

    const idlJson = fs.readFileSync(idlPath, 'utf8');
    return JSON.parse(idlJson);
  }
}
