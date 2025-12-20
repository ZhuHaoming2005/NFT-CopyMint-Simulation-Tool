// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CopyMintNFT
 * @dev A minimal ERC-721 contract for CopyMint attack demonstration.
 *
 * This contract allows copying any NFT project by:
 * - Setting custom name, symbol, baseURI
 * - Configurable max supply
 * - Free minting for demonstration purposes
 *
 * WARNING: This is for research purposes only.
 * CopyMint attacks are unethical and potentially illegal.
 */
contract CopyMintNFT is ERC721Enumerable, Ownable, ERC721Burnable, ReentrancyGuard {
    // Token ID counter
    uint256 private _tokenIdTracker;

    // Maximum number of tokens that can be minted
    uint256 public maxElements;

    // Maximum tokens per mint transaction
    uint256 public maxPerMint;

    // Base URI for token metadata
    string public baseTokenURI;

    // Events
    event TokenMinted(address indexed to, uint256 indexed tokenId);
    event BaseURIUpdated(string newBaseURI);
    event MaxElementsUpdated(uint256 newMaxElements);
    event FundsWithdrawn(address indexed to, uint256 amount);

    /**
     * @dev Constructor to initialize the NFT contract
     * @param name_ Token name (e.g., "CopiedPunks")
     * @param symbol_ Token symbol (e.g., "CPUNKS")
     * @param baseURI_ Base URI for metadata (e.g., "ipfs://Qm.../")
     * @param maxElements_ Maximum supply of tokens
     * @param maxPerMint_ Maximum tokens per mint transaction
     */
    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        uint256 maxElements_,
        uint256 maxPerMint_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        require(maxElements_ > 0, "CopyMintNFT: Max supply must be > 0");
        require(maxPerMint_ > 0, "CopyMintNFT: Max per mint must be > 0");
        require(maxPerMint_ <= maxElements_, "CopyMintNFT: Max per mint cannot exceed max supply");

        baseTokenURI = baseURI_;
        maxElements = maxElements_;
        maxPerMint = maxPerMint_;
    }

    /**
     * @dev Returns current total minted count
     */
    function totalMint() public view returns (uint256) {
        return _tokenIdTracker;
    }

    /**
     * @dev Mint tokens to an address
     * @param to Recipient address
     * @param count Number of tokens to mint
     */
    function mint(address to, uint256 count) public {
        require(to != address(0), "CopyMintNFT: Cannot mint to zero address");
        require(_tokenIdTracker + count <= maxElements, "CopyMintNFT: Exceeds max supply");
        require(count > 0 && count <= maxPerMint, "CopyMintNFT: Invalid mint count");

        for (uint256 i = 0; i < count; i++) {
            _mintToken(to);
        }
    }

    /**
     * @dev Internal function to mint a single token
     * @param to Recipient address
     */
    function _mintToken(address to) private {
        uint256 id = _tokenIdTracker;
        _tokenIdTracker = _tokenIdTracker + 1;
        _safeMint(to, id);
        emit TokenMinted(to, id);
    }

    /**
     * @dev Returns the base URI for token metadata
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return baseTokenURI;
    }

    /**
     * @dev Set new base URI (owner only)
     * @param newBaseURI New base URI
     */
    function setBaseURI(string memory newBaseURI) public onlyOwner {
        baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    /**
     * @dev Set max elements (owner only)
     * @param newMaxElements New max supply
     */
    function setMaxElements(uint256 newMaxElements) public onlyOwner {
        require(newMaxElements >= _tokenIdTracker, "CopyMintNFT: Cannot be less than current supply");
        require(newMaxElements > 0, "CopyMintNFT: Max supply must be > 0");
        maxElements = newMaxElements;
        emit MaxElementsUpdated(newMaxElements);
    }

    /**
     * @dev Set max per mint (owner only)
     * @param newMaxPerMint New max per mint
     */
    function setMaxPerMint(uint256 newMaxPerMint) public onlyOwner {
        require(newMaxPerMint > 0, "CopyMintNFT: Max per mint must be > 0");
        require(newMaxPerMint <= maxElements, "CopyMintNFT: Max per mint cannot exceed max supply");
        maxPerMint = newMaxPerMint;
    }

    /**
     * @dev Get all token IDs owned by an address
     * @param tokenOwner Address to query
     * @return Array of token IDs
     */
    function walletOfOwner(address tokenOwner) external view returns (uint256[] memory) {
        require(tokenOwner != address(0), "CopyMintNFT: Zero address not allowed");
        uint256 tokenCount = balanceOf(tokenOwner);
        uint256[] memory tokensId = new uint256[](tokenCount);

        for (uint256 i = 0; i < tokenCount; i++) {
            tokensId[i] = tokenOfOwnerByIndex(tokenOwner, i);
        }

        return tokensId;
    }

    /**
     * @dev Withdraw contract balance to owner (owner only)
     * Protected against reentrancy attacks
     */
    function withdraw() public onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "CopyMintNFT: No balance to withdraw");

        address payable recipient = payable(owner());
        (bool success, ) = recipient.call{value: balance}("");
        require(success, "CopyMintNFT: Withdrawal failed");

        emit FundsWithdrawn(recipient, balance);
    }

    /**
     * @dev Hook for token transfer - required override for ERC721Enumerable
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        virtual
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Hook to increase balance - required override for ERC721Enumerable
     */
    function _increaseBalance(address account, uint128 value)
        internal
        virtual
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    /**
     * @dev Interface support check - required override
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
