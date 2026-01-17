import axios from 'axios';
import { PinataSDK } from 'pinata';
import { NFTMetadata, CopyMintLevel } from './types';

export class IPFSService {
  private pinata: PinataSDK;

  constructor() {
    // Initialize Pinata SDK
    const pinataJwt = process.env.PINATA_JWT;
    const pinataGateway = process.env.NEXT_PUBLIC_GATEWAY_URL;
    if (!pinataGateway) {
      throw new Error('NEXT_PUBLIC_GATEWAY_URL must be configured. Get it from https://pinata.cloud');
    }
    if (pinataJwt) {
      this.pinata = new PinataSDK({
        pinataJwt: pinataJwt,
        pinataGateway: pinataGateway,
      });
    } else {
      // Fallback to API keys (deprecated but still supported)
      const apiKey = process.env.PINATA_API_KEY;
      const secretKey = process.env.PINATA_SECRET_KEY;
      if (apiKey && secretKey) {
        this.pinata = new PinataSDK({
          pinataJwt: Buffer.from(`${apiKey}:${secretKey}`).toString('base64'),
          pinataGateway: pinataGateway,
        });
      } else {
        throw new Error('Pinata JWT or API keys must be configured. Get them from https://pinata.cloud');
      }
    }
  }

  /**
   * Download file from IPFS or HTTP URL
   */
  async downloadFile(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to download file from ${url}: ${error}`);
    }
  }

  /**
   * Upload file to IPFS via Pinata SDK
   */
  async uploadToPinata(fileBuffer: Buffer, fileName: string): Promise<string> {
    try {
      const uint8Array = new Uint8Array(fileBuffer);
      const blob = new Blob([uint8Array], { type: 'application/octet-stream' });
      const file = new File([blob], fileName);

      const upload = await this.pinata.upload.public.file(file);
      return upload.cid;
    } catch (error) {
      throw new Error(`Failed to upload to Pinata: ${error}`);
    }
  }

  /**
   * Upload JSON metadata to IPFS
   */
  async uploadMetadata(metadata: NFTMetadata): Promise<string> {
    try {
      const metadataString = JSON.stringify(metadata, null, 2);
      const blob = new Blob([metadataString], { type: 'application/json' });
      const file = new File([blob], 'metadata.json');

      const upload = await this.pinata.upload.public.file(file);
      return upload.cid;
    } catch (error) {
      throw new Error(`Failed to upload metadata to Pinata: ${error}`);
    }
  }

  /**
   * Download NFT metadata from tokenURI
   */
  async downloadMetadata(tokenURI: string): Promise<NFTMetadata> {
    try {
      // Handle IPFS URIs
      let url = tokenURI;
      if (url.startsWith('ipfs://')) {
        url = url.replace('ipfs/', '');
        url = url.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
      }

      const response = await axios.get(url);
      return response.data as NFTMetadata;
    } catch (error) {
      throw new Error(`Failed to download metadata from ${tokenURI}: ${error}`);
    }
  }

  /**
   * Process CopyMint Level 1: Direct baseURI copy
   * Simply returns the original baseURI
   */
  async processLevel1(originalBaseURI: string): Promise<string> {
    console.log('CopyMint Level 1: Using original baseURI');
    return originalBaseURI;
  }

  /**
   * Process CopyMint Level 2: Re-upload metadata JSON files
   * Downloads all metadata JSON files and re-uploads them to create new baseURI
   * All files are uploaded together to get a unified folder CID
   * @param maxCopyCount Maximum number of tokens to copy (0 or undefined = no limit)
   */
  async processLevel2(
    _originalContract: string,
    totalSupply: number,
    originalBaseURI: string,
    maxCopyCount?: number
  ): Promise<string> {
    // Determine actual copy count
    const copyCount = maxCopyCount && maxCopyCount > 0 
      ? Math.min(maxCopyCount, totalSupply) 
      : totalSupply;

    console.log(`CopyMint Level 2: Re-uploading metadata JSON files as a folder`);
    console.log(`Total supply: ${totalSupply}, Copying: ${copyCount} token${copyCount > 1 ? 's' : ''}`);

    const files: File[] = [];

    // Download metadata files (limited by copyCount)
    for (let tokenId = 0; tokenId < copyCount; tokenId++) {
      try {
        // Construct original tokenURI
        const originalTokenURI = originalBaseURI.endsWith('/')
          ? `${originalBaseURI}${tokenId}`
          : `${originalBaseURI}/${tokenId}`;

        // Download original metadata
        let metadata: NFTMetadata = await this.downloadMetadata(originalTokenURI);

        if(metadata.image) {
          metadata.image = metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/');
        }

        // Convert metadata to File object with tokenId as filename
        const metadataString = JSON.stringify(metadata, null, 2);
        const blob = new Blob([metadataString], { type: 'application/json' });
        const file = new File([blob], `${tokenId}`);
        files.push(file);

        console.log(`Downloaded metadata for token ${tokenId}`);
      } catch (error) {
        console.error(`Failed to process token ${tokenId}:`, error);
        // Continue with other tokens
      }
    }

    if (files.length === 0) {
      throw new Error('No metadata files were successfully downloaded');
    }

    // Upload all files as a folder to get unified CID
    console.log(`Uploading ${files.length} metadata files as a folder...`);
    const upload = await this.pinata.upload.public.fileArray(files);
    const folderCID = upload.cid;

    console.log(`Folder uploaded with CID: ${folderCID}`);
    const newBaseURI = `ipfs://${folderCID}/`;
    return newBaseURI;
  }

  /**
   * Process CopyMint Level 3: Re-upload images and modify metadata
   * Downloads images, re-uploads them, and updates metadata JSON files
   * Images are uploaded as a folder first to get a unified CID, then metadata references the image folder CID
   * @param maxCopyCount Maximum number of tokens to copy (0 or undefined = no limit)
   */
  async processLevel3(
    _originalContract: string,
    totalSupply: number,
    originalBaseURI: string,
    maxCopyCount?: number
  ): Promise<string> {
    // Determine actual copy count
    const copyCount = maxCopyCount && maxCopyCount > 0 
      ? Math.min(maxCopyCount, totalSupply) 
      : totalSupply;

    console.log('CopyMint Level 3: Re-uploading images and metadata with proper CID references');
    console.log(`Total supply: ${totalSupply}, Copying: ${copyCount} token${copyCount > 1 ? 's' : ''}`);

    // Storage for downloaded data
    const metadataCache: Map<number, NFTMetadata> = new Map();
    const imageFiles: File[] = [];
    const imageFilenames: Map<number, string> = new Map();

    // Step 1: Download all metadata and images, cache them in memory
    console.log('Step 1: Downloading all metadata and images...');
    for (let tokenId = 0; tokenId < copyCount; tokenId++) {
      try {
        // Construct original tokenURI
        const originalTokenURI = originalBaseURI.endsWith('/')
          ? `${originalBaseURI}${tokenId}`
          : `${originalBaseURI}/${tokenId}`;

        // Download original metadata and cache it
        const originalMetadata = await this.downloadMetadata(originalTokenURI);
        metadataCache.set(tokenId, originalMetadata);

        // Download and prepare image if it exists
        let imageUrl: string;
        if (originalMetadata.image)
          imageUrl = originalMetadata.image;
        else if(originalMetadata.uri)
          imageUrl = originalMetadata.uri;
        else if(originalMetadata.data && originalMetadata.data.url)
          imageUrl = originalMetadata.data.url;
        else
          throw new Error(`No image URL found for token ${tokenId}`);

        if (imageUrl && imageUrl.startsWith('ipfs://')) {
          imageUrl = imageUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
        }

        // Download image
        const imageBuffer = await this.downloadFile(imageUrl);

        // Create image File object
        const fileExtension = this.getImageExtension(imageUrl);
        const imageFilename = `${tokenId}${fileExtension}`;
        const uint8Array = new Uint8Array(imageBuffer);
        const blob = new Blob([uint8Array], { type: 'application/octet-stream' });
        const imageFile = new File([blob], imageFilename);
        imageFiles.push(imageFile);

        // Store the mapping for metadata update
        imageFilenames.set(tokenId, imageFilename);

        console.log(`Downloaded metadata and image for token ${tokenId}`);
      } catch (error) {
        console.error(`Failed to download data for token ${tokenId}:`, error);
        // Continue with other tokens
      }
    }

    if (metadataCache.size === 0) {
      throw new Error('No metadata files were successfully downloaded');
    }

    // Step 2: Upload all images as a folder to get unified images folder CID
    let imagesFolderCID = '';
    if (imageFiles.length > 0) {
      console.log(`\nStep 2: Uploading ${imageFiles.length} images as a folder...`);
      const imagesUpload = await this.pinata.upload.public.fileArray(imageFiles);
      imagesFolderCID = imagesUpload.cid;
      console.log(`Images folder uploaded with CID: ${imagesFolderCID}`);
    } else {
      console.log('\nStep 2: No images to upload');
    }

    // Step 3: Create metadata files with updated image references using CID
    console.log('\nStep 3: Creating metadata files with CID references...');
    const metadataFiles: File[] = [];
    for (let tokenId = 0; tokenId < copyCount; tokenId++) {
      try {
        const originalMetadata = metadataCache.get(tokenId);
        if (!originalMetadata) {
          continue;
        }

        // Update image reference to use the images folder CID
        const newMetadata: NFTMetadata = {
          ...originalMetadata,
        };

        if (imageFilenames.has(tokenId) && imagesFolderCID) {
          // Use full IPFS path with images folder CID
          const imageFilename = imageFilenames.get(tokenId)!;
          newMetadata.image = `https://ipfs.io/ipfs/${imagesFolderCID}/${imageFilename}`;
        }

        // Create metadata File object
        const metadataString = JSON.stringify(newMetadata, null, 2);
        const blob = new Blob([metadataString], { type: 'application/json' });
        const file = new File([blob], `${tokenId}`);
        metadataFiles.push(file);

        console.log(`Prepared metadata for token ${tokenId}${imageFilenames.has(tokenId) ? ' with image CID reference' : ''}`);
      } catch (error) {
        console.error(`Failed to prepare metadata for token ${tokenId}:`, error);
      }
    }

    if (metadataFiles.length === 0) {
      throw new Error('No metadata files were successfully prepared');
    }

    // Step 4: Upload all metadata as a folder
    console.log(`\nStep 4: Uploading ${metadataFiles.length} metadata files as a folder...`);
    const metadataUpload = await this.pinata.upload.public.fileArray(metadataFiles);
    const metadataFolderCID = metadataUpload.cid;

    console.log(`Metadata folder uploaded with CID: ${metadataFolderCID}`);
    if (imagesFolderCID) {
      console.log(`Images folder CID: ${imagesFolderCID}`);
    }
    
    const newBaseURI = `ipfs://${metadataFolderCID}/`;
    return newBaseURI;
  }

  /**
   * Get file extension from image URL
   */
  private getImageExtension(imageUrl: string): string {
    const urlParts = imageUrl.split('.');
    if (urlParts.length === 0) {
      return '.png'; // Default to .png
    } else if (urlParts.length === 1) {
      return ''; // Default to None if no extension
    } else {
      const extension = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params
      return extension ? `.${extension}` : '.png'; // Default to .png if no extension
    }
  }

  /**
   * Process CopyMint based on specified level
   * @param maxCopyCount Maximum number of tokens to copy (0 or undefined = no limit, for debugging)
   */
  async processCopyMint(
    level: CopyMintLevel,
    originalContract: string,
    totalSupply: number,
    originalBaseURI: string,
    maxCopyCount?: number
  ): Promise<string> {
    switch (level) {
      case CopyMintLevel.LEVEL_1:
        return this.processLevel1(originalBaseURI);
      case CopyMintLevel.LEVEL_2:
        return this.processLevel2(originalContract, totalSupply, originalBaseURI, maxCopyCount);
      case CopyMintLevel.LEVEL_3:
        return this.processLevel3(originalContract, totalSupply, originalBaseURI, maxCopyCount);
      default:
        throw new Error(`Invalid CopyMint level: ${level}`);
    }
  }
}
