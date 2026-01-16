use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_master_edition_v3, create_metadata_accounts_v3, set_and_verify_collection,
        CreateMasterEditionV3, CreateMetadataAccountsV3, Metadata, SetAndVerifyCollection,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};
use mpl_token_metadata::{
    types::{Collection, Creator, DataV2},
};

declare_id!("DvtTifYdLRvMqd1syNNitnmwXrnp4ggt95KKpHPam24u");

#[program]
pub mod CopyMintNFT {
    use super::*;

    /// Initialize the CopyMint NFT Collection
    /// This creates a Collection NFT that all minted NFTs will belong to
    pub fn initialize_collection(
        ctx: Context<InitializeCollection>,
        name: String,
        symbol: String,
        uri: String,
        max_supply: u64,
        max_per_mint: u64,
    ) -> Result<()> {
        require!(max_supply > 0, CopyMintError::InvalidMaxSupply);
        require!(max_per_mint > 0 && max_per_mint <= max_supply, CopyMintError::InvalidMaxPerMint);

        let collection_state = &mut ctx.accounts.collection_state;
        collection_state.authority = ctx.accounts.authority.key();
        collection_state.collection_mint = ctx.accounts.collection_mint.key();
        collection_state.name = name.clone();
        collection_state.symbol = symbol.clone();
        collection_state.base_uri = uri.clone();
        collection_state.max_supply = max_supply;
        collection_state.max_per_mint = max_per_mint;
        collection_state.total_minted = 0;
        collection_state.bump = ctx.bumps.collection_state;

        // Mint the collection NFT (supply = 1)
        mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.collection_mint.to_account_info(),
                    to: ctx.accounts.collection_token_account.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            1,
        )?;

        // Create metadata for collection NFT
        let creator = vec![Creator {
            address: ctx.accounts.authority.key(),
            verified: true,
            share: 100,
        }];

        create_metadata_accounts_v3(
            CpiContext::new(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    metadata: ctx.accounts.collection_metadata.to_account_info(),
                    mint: ctx.accounts.collection_mint.to_account_info(),
                    mint_authority: ctx.accounts.authority.to_account_info(),
                    update_authority: ctx.accounts.authority.to_account_info(),
                    payer: ctx.accounts.authority.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
            ),
            DataV2 {
                name: name.clone(),
                symbol: symbol.clone(),
                uri: uri.clone(),
                seller_fee_basis_points: 0,
                creators: Some(creator),
                collection: None,
                uses: None,
            },
            true,  // is_mutable
            true,  // update_authority_is_signer
            None,  // collection_details
        )?;

        // Create master edition for collection NFT
        create_master_edition_v3(
            CpiContext::new(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMasterEditionV3 {
                    edition: ctx.accounts.collection_master_edition.to_account_info(),
                    mint: ctx.accounts.collection_mint.to_account_info(),
                    update_authority: ctx.accounts.authority.to_account_info(),
                    mint_authority: ctx.accounts.authority.to_account_info(),
                    payer: ctx.accounts.authority.to_account_info(),
                    metadata: ctx.accounts.collection_metadata.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
            ),
            Some(0), // max_supply = 0 for collection
        )?;

        emit!(CollectionInitialized {
            collection_mint: ctx.accounts.collection_mint.key(),
            authority: ctx.accounts.authority.key(),
            name,
            symbol,
            max_supply,
        });

        Ok(())
    }

    /// Mint a single NFT in the collection
    pub fn mint_nft(
        ctx: Context<MintNFT>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        // First, check max supply (read-only)
        require!(
            ctx.accounts.collection_state.total_minted < ctx.accounts.collection_state.max_supply,
            CopyMintError::MaxSupplyReached
        );

        // Extract data we need from collection_state before any borrows
        let authority = ctx.accounts.collection_state.authority;
        let collection_mint_key = ctx.accounts.collection_state.collection_mint;
        let bump = ctx.accounts.collection_state.bump;

        // Mint the NFT token (supply = 1)
        mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.nft_mint.to_account_info(),
                    to: ctx.accounts.nft_token_account.to_account_info(),
                    authority: ctx.accounts.recipient.to_account_info(),
                },
            ),
            1,
        )?;

        // Create metadata for NFT
        let creator = vec![Creator {
            address: authority,
            verified: false, // Will be verified through collection
            share: 100,
        }];

        create_metadata_accounts_v3(
            CpiContext::new(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    metadata: ctx.accounts.nft_metadata.to_account_info(),
                    mint: ctx.accounts.nft_mint.to_account_info(),
                    mint_authority: ctx.accounts.recipient.to_account_info(),
                    update_authority: ctx.accounts.recipient.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
            ),
            DataV2 {
                name,
                symbol,
                uri,
                seller_fee_basis_points: 0,
                creators: Some(creator),
                collection: Some(Collection {
                    verified: false,
                    key: collection_mint_key,
                }),
                uses: None,
            },
            true,  // is_mutable
            true,  // update_authority_is_signer
            None,  // collection_details
        )?;

        // Create master edition for NFT
        create_master_edition_v3(
            CpiContext::new(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMasterEditionV3 {
                    edition: ctx.accounts.nft_master_edition.to_account_info(),
                    mint: ctx.accounts.nft_mint.to_account_info(),
                    update_authority: ctx.accounts.recipient.to_account_info(),
                    mint_authority: ctx.accounts.recipient.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    metadata: ctx.accounts.nft_metadata.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
            ),
            Some(0), // max_supply = 0 for unique NFT
        )?;

        // Verify collection
        let collection_state_seeds = &[
            b"collection_state",
            collection_mint_key.as_ref(),
            &[bump],
        ];
        let signer_seeds = &[&collection_state_seeds[..]];

        set_and_verify_collection(
            CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                SetAndVerifyCollection {
                    metadata: ctx.accounts.nft_metadata.to_account_info(),
                    collection_authority: ctx.accounts.collection_state.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    update_authority: ctx.accounts.recipient.to_account_info(),
                    collection_mint: ctx.accounts.collection_mint.to_account_info(),
                    collection_metadata: ctx.accounts.collection_metadata.to_account_info(),
                    collection_master_edition: ctx.accounts.collection_master_edition.to_account_info(),
                },
                signer_seeds,
            ),
            None,
        )?;

        // Now get mutable reference to update counter
        let collection_state = &mut ctx.accounts.collection_state;
        let token_id = collection_state.total_minted;
        collection_state.total_minted += 1;

        emit!(NFTMinted {
            mint: ctx.accounts.nft_mint.key(),
            recipient: ctx.accounts.recipient.key(),
            token_id,
        });

        Ok(())
    }

    /// Update base URI (authority only)
    pub fn update_base_uri(ctx: Context<UpdateBaseURI>, new_uri: String) -> Result<()> {
        let collection_state = &mut ctx.accounts.collection_state;
        collection_state.base_uri = new_uri.clone();

        emit!(BaseURIUpdated {
            collection_mint: collection_state.collection_mint,
            new_uri,
        });

        Ok(())
    }

    /// Update max supply (authority only)
    pub fn update_max_supply(ctx: Context<UpdateMaxSupply>, new_max_supply: u64) -> Result<()> {
        let collection_state = &mut ctx.accounts.collection_state;

        require!(
            new_max_supply >= collection_state.total_minted,
            CopyMintError::InvalidMaxSupply
        );
        require!(new_max_supply > 0, CopyMintError::InvalidMaxSupply);

        collection_state.max_supply = new_max_supply;

        emit!(MaxSupplyUpdated {
            collection_mint: collection_state.collection_mint,
            new_max_supply,
        });

        Ok(())
    }
}

// Account Structures

#[derive(Accounts)]
pub struct InitializeCollection<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        seeds = [b"collection_state", collection_mint.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + CollectionState::INIT_SPACE
    )]
    pub collection_state: Account<'info, CollectionState>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 0,
        mint::authority = authority,
        mint::freeze_authority = authority,
    )]
    pub collection_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = collection_mint,
        associated_token::authority = authority,
    )]
    pub collection_token_account: Account<'info, TokenAccount>,

    /// CHECK: Metadata account will be created by Metaplex
    #[account(mut)]
    pub collection_metadata: UncheckedAccount<'info>,

    /// CHECK: Master edition account will be created by Metaplex
    #[account(mut)]
    pub collection_master_edition: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintNFT<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Recipient can be any account
    pub recipient: Signer<'info>,

    #[account(
        mut,
        seeds = [b"collection_state", collection_state.collection_mint.as_ref()],
        bump = collection_state.bump,
    )]
    pub collection_state: Account<'info, CollectionState>,

    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = recipient,
        mint::freeze_authority = recipient,
    )]
    pub nft_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = nft_mint,
        associated_token::authority = recipient,
    )]
    pub nft_token_account: Account<'info, TokenAccount>,

    /// CHECK: Metadata account will be created by Metaplex
    #[account(mut)]
    pub nft_metadata: UncheckedAccount<'info>,

    /// CHECK: Master edition account will be created by Metaplex
    #[account(mut)]
    pub nft_master_edition: UncheckedAccount<'info>,

    pub collection_mint: Account<'info, Mint>,

    /// CHECK: Collection metadata account
    #[account(mut)]
    pub collection_metadata: UncheckedAccount<'info>,

    /// CHECK: Collection master edition account
    #[account(mut)]
    pub collection_master_edition: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UpdateBaseURI<'info> {
    #[account(
        mut,
        has_one = authority,
    )]
    pub collection_state: Account<'info, CollectionState>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateMaxSupply<'info> {
    #[account(
        mut,
        has_one = authority,
    )]
    pub collection_state: Account<'info, CollectionState>,

    pub authority: Signer<'info>,
}

// State

#[account]
#[derive(InitSpace)]
pub struct CollectionState {
    pub authority: Pubkey,
    pub collection_mint: Pubkey,
    #[max_len(32)]
    pub name: String,
    #[max_len(10)]
    pub symbol: String,
    #[max_len(200)]
    pub base_uri: String,
    pub max_supply: u64,
    pub max_per_mint: u64,
    pub total_minted: u64,
    pub bump: u8,
}

// Events

#[event]
pub struct CollectionInitialized {
    pub collection_mint: Pubkey,
    pub authority: Pubkey,
    pub name: String,
    pub symbol: String,
    pub max_supply: u64,
}

#[event]
pub struct NFTMinted {
    pub mint: Pubkey,
    pub recipient: Pubkey,
    pub token_id: u64,
}

#[event]
pub struct BaseURIUpdated {
    pub collection_mint: Pubkey,
    pub new_uri: String,
}

#[event]
pub struct MaxSupplyUpdated {
    pub collection_mint: Pubkey,
    pub new_max_supply: u64,
}

// Errors

#[error_code]
pub enum CopyMintError {
    #[msg("Max supply must be greater than 0 and max_supply >= total_minted")]
    InvalidMaxSupply,
    #[msg("Max per mint must be > 0 and <= max_supply")]
    InvalidMaxPerMint,
    #[msg("Maximum supply has been reached")]
    MaxSupplyReached,
}
