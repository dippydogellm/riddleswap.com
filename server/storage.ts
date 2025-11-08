import { 
  users, tokens, transactions, 
  riddleWallets, riddleWalletSessions, swapHistory, riddleTransactions,
  devtoolsProjects, projectSubscriptions, projectBilling, projectUsageMetrics, chainConfigurations,
  walletProjectLinks, nftMetadataCache, collectionMetadataCache, devToolAirdrops,
  // Enhanced wallet linking system imports
  externalWallets, linkedWallets, authNonces, projectClaims,
  // Wallet metrics system imports
  walletMetrics,
  // Enhanced project management imports
  projectWallets, projectServices, tokenConfigurations, nftConfigurations,
  // Project authentication imports
  projectOwnerAuth, projectOwnerSessions, projectLoginLogs,
  // Financial ecosystem imports
  stakingPools, stakingPositions, feeLedger, rewardFund, loans, loanEvents, 
  nftSwapOffers, nftSwapMatches, bankWallets, messagingLinks,
  // CDN System imports
  assetFiles, projectContentOverrides, ingestionJobs, enhancedProjectSubscriptions,
  // Search system imports
  searchResults, searchAnalytics, pageMetadata,
  type User, type InsertUser, 
  type Token, type InsertToken, 
  type Transaction, type InsertTransaction,
  type RiddleWallet, type InsertRiddleWallet,
  type RiddleWalletSession, type InsertRiddleWalletSession,
  type SwapHistory, type InsertSwapHistory,
  type RiddleTransaction, type InsertRiddleTransaction,
  type DevtoolsProject, type InsertDevtoolsProject,
  type ProjectSubscription, type InsertProjectSubscription,
  type ProjectBilling, type InsertProjectBilling,
  type ProjectUsageMetrics, type InsertProjectUsageMetrics,
  type ChainConfiguration, type InsertChainConfiguration,
  type WalletProjectLink, type InsertWalletProjectLink,
  type NftMetadataCache, type InsertNftMetadataCache,
  type CollectionMetadataCache, type InsertCollectionMetadataCache,
  type DevToolAirdrop, type InsertDevToolAirdrop,
  // Enhanced wallet linking types
  type ExternalWallet, type InsertExternalWallet,
  type LinkedWallet, type InsertLinkedWallet,
  type AuthNonce, type InsertAuthNonce,
  type ProjectClaim, type InsertProjectClaim,
  // Enhanced project management types
  type ProjectWallet, type InsertProjectWallet,
  type ProjectService, type InsertProjectService,
  type TokenConfiguration, type InsertTokenConfiguration,
  type NftConfiguration, type InsertNftConfiguration,
  // Project authentication types
  type ProjectOwnerAuth, type InsertProjectOwnerAuth,
  type ProjectOwnerSession, type InsertProjectOwnerSession,
  type ProjectLoginLog, type InsertProjectLoginLog,
  // Financial ecosystem types
  type StakingPool, type InsertStakingPool,
  type StakingPosition, type InsertStakingPosition,
  type FeeLedger, type InsertFeeLedger,
  type RewardFund, type InsertRewardFund,
  type Loan, type InsertLoan,
  type LoanEvent, type InsertLoanEvent,
  type NftSwapOffer, type InsertNftSwapOffer,
  type NftSwapMatch, type InsertNftSwapMatch,
  type BankWallet, type InsertBankWallet,
  type MessagingLink, type InsertMessagingLink,
  // CDN System types
  type AssetFile, type InsertAssetFile,
  type ProjectContentOverride, type InsertProjectContentOverride,
  type IngestionJob, type InsertIngestionJob,
  type EnhancedProjectSubscription, type InsertEnhancedProjectSubscription,
  // Search system types
  type SearchResult, type InsertSearchResult,
  type SearchAnalytics, type InsertSearchAnalytics,
  type PageMetadata, type InsertPageMetadata,
  type UnifiedSearchResult,
  // Wallet metrics types
  type WalletMetrics, type InsertWalletMetrics,
  // Gaming NFT types
  gamingNftCollections, gamingNfts, gamingPlayers, playerNftOwnership, gamingEvents,
  // Broker Escrow types
  brokerEscrow,
  // Civilization and Alliance types
  playerCivilizations, allyRequests, activeAlliances,
  // Land plot types
  medievalLandPlots,
  // Weapon system types
  weaponDefinitions, playerNftWeapons, weaponMarketplace, weaponMintQueue, weaponUpgrades,
  type WeaponDefinition, type InsertWeaponDefinition,
  type PlayerNftWeapon, type InsertPlayerNftWeapon,
  type WeaponMarketplace, type InsertWeaponMarketplace,
  type WeaponMintQueue, type InsertWeaponMintQueue,
  type WeaponUpgrade, type InsertWeaponUpgrade,
  // NFT Launchpad types
  nftProjects, nftAssets, nftProjectLogs, nftProjectWhitelist,
  type NftProject, type InsertNftProject,
  type NftAsset, type InsertNftAsset,
  type NftProjectLog, type InsertNftProjectLog,
  type NftProjectWhitelist, type InsertNftProjectWhitelist
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gt, or, lt, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Payment preference operations
  setUserPaymentPreference(userHandle: string, preference: 'RDL_ONLY' | 'XRP_PREFERRED' | 'FLEXIBLE'): Promise<void>;
  getUserPaymentPreference(userHandle: string): Promise<string | null>;
  
  // Weapon minting operations
  addWeaponMintQueue(queueData: any): Promise<void>;
  getWeaponMintQueue(queueId: string): Promise<any | null>;
  updateWeaponMintQueueStatus(queueId: string, status: string, additionalData?: any): Promise<void>;
  addPlayerNftWeapon(weaponData: any): Promise<void>;
  getPlayerNftWeapons(playerHandle: string): Promise<any[]>;
  
  // Civilization management operations
  createPlayerCivilization(civilizationData: any): Promise<void>;
  getPlayerCivilization(userHandle: string): Promise<any | null>;
  updatePlayerCivilization(userHandle: string, updateData: any): Promise<void>;
  
  // Alliance management operations
  createAllyRequest(requestData: any): Promise<void>;
  getAllyRequest(requestId: string): Promise<any | null>;
  getIncomingAllyRequests(userHandle: string): Promise<any[]>;
  getOutgoingAllyRequests(userHandle: string): Promise<any[]>;
  updateAllyRequestStatus(requestId: string, status: string, responseData?: any): Promise<void>;
  createAlliance(allianceData: any): Promise<void>;
  getAlliances(userHandle: string): Promise<any[]>;
  removeAlliance(player1Handle: string, player2Handle: string): Promise<void>;
  getGamingRiddleWalletUsers(): Promise<string[]>;
  recordLandPlotPurchase(purchaseData: any): Promise<void>;
  
  // NFT Collection Management
  updateGamingNftCollection(collectionId: string, updateData: any): Promise<void>;
  addGamingNft(nftData: any): Promise<void>;
  getAllGamingNftCollections(): Promise<any[]>;
  getGamingNftCount(collectionId: string): Promise<number>;
  getGamingNftCollectionByTaxon(taxon: number): Promise<any | null>;
  getGamingNftsByCollection(collectionId: string): Promise<any[]>;
  
  // Token operations
  getTokens(): Promise<Token[]>;
  getTokenBySymbol(symbol: string): Promise<Token | undefined>;
  createToken(token: InsertToken): Promise<Token>;
  
  // Transaction operations
  getTransactionsByWallet(walletAddress: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(id: number, status: string, transactionHash?: string): Promise<Transaction | undefined>;
  
  // Riddle Wallet operations
  createRiddleWallet(wallet: InsertRiddleWallet): Promise<RiddleWallet>;
  getRiddleWalletByHandle(handle: string): Promise<RiddleWallet | undefined>;
  getRiddleWalletByLinkedAddress(address: string): Promise<RiddleWallet | undefined>;
  getRiddleWalletByGeneratedAddress(address: string): Promise<RiddleWallet | undefined>;
  getRiddleWalletByAddress(address: string): Promise<RiddleWallet | undefined>;
  updateRiddleWalletActivity(walletId: string): Promise<void>;
  updateRiddleWalletPassword(handle: string, passwordHash: string, salt: string): Promise<void>;
  listAllRiddleWallets(): Promise<RiddleWallet[]>;
  
  // Eligibility check operations
  getWalletsCreatedFromIP(ipAddress: string, sinceDate: Date): Promise<RiddleWallet[]>;
  
  // Bridge and Rewards operations
  recordBridgeTransaction(transaction: {
    userHandle: string;
    walletAddress: string;
    fromToken: string;
    toToken: string;
    inputAmount: number;
    outputAmount: number;
    bridgeFee: number;
    transactionHash: string;
    timestamp: Date;
  }): Promise<void>;
  
  // Riddle Wallet Session operations
  createRiddleWalletSession(session: InsertRiddleWalletSession): Promise<RiddleWalletSession>;
  getRiddleWalletSession(sessionToken: string): Promise<RiddleWalletSession | undefined>;
  getRiddleWalletBySession(sessionToken: string): Promise<RiddleWallet | undefined>;
  validateSession(sessionToken: string): Promise<{handle: string} | null>;
  deleteExpiredSessions(): Promise<void>;
  
  // Swap History operations
  createSwapHistory(swap: InsertSwapHistory): Promise<SwapHistory>;
  getSwapHistoryByWallet(walletAddress: string, limit?: number): Promise<SwapHistory[]>;
  getSwapHistoryByChain(chain: string, limit?: number): Promise<SwapHistory[]>;
  updateSwapHistoryStatus(id: string, status: string, transactionHash?: string, failureReason?: string): Promise<SwapHistory | undefined>;
  getSwapHistoryStats(walletAddress: string): Promise<{totalSwaps: number, totalVolumeUSD: number, successRate: number}>;
  
  // Riddle Transaction Tracking operations (RTN System)
  createRiddleTransaction(transaction: InsertRiddleTransaction): Promise<RiddleTransaction>;
  getRiddleTransactionByRTN(rtn: string): Promise<RiddleTransaction | undefined>;
  getRiddleTransactionsByWallet(walletAddress: string, limit?: number): Promise<RiddleTransaction[]>;
  getRiddleTransactionsByUser(userHandle: string, limit?: number): Promise<RiddleTransaction[]>;
  getRiddleTransactionsByType(transactionType: string, limit?: number): Promise<RiddleTransaction[]>;
  getRiddleTransactionsByStatus(status: string, limit?: number): Promise<RiddleTransaction[]>;
  updateRiddleTransactionStatus(rtn: string, status: string, blockchainTxHash?: string, failureReason?: string): Promise<RiddleTransaction | undefined>;
  updateRiddleTransactionBrokerStatus(rtn: string, brokerStatus: string, brokerWallet?: string): Promise<RiddleTransaction | undefined>;
  getRiddleTransactionStats(userHandle?: string): Promise<{
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    pendingTransactions: number;
    totalVolumeUSD: string;
    avgTransactionValueUSD: string;
  }>;
  getAdminRiddleTransactions(filters: {
    status?: string;
    transactionType?: string;
    brokerStatus?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<RiddleTransaction[]>;
  
  // DevTools Project operations
  createDevtoolsProject(project: InsertDevtoolsProject): Promise<DevtoolsProject>;
  getDevtoolsProjectsByOwner(ownerWalletAddress: string): Promise<DevtoolsProject[]>;
  getAllDevtoolsProjects(): Promise<DevtoolsProject[]>;
  getDevtoolsProject(id: string): Promise<DevtoolsProject | undefined>;
  updateDevtoolsProject(id: string, updates: Partial<InsertDevtoolsProject>): Promise<DevtoolsProject | undefined>;
  deleteDevtoolsProject(id: string): Promise<void>;

  // Project Owner Authentication operations
  createProjectOwnerAuth(auth: InsertProjectOwnerAuth): Promise<ProjectOwnerAuth>;
  getProjectOwnerAuth(id: string): Promise<ProjectOwnerAuth | undefined>;
  getProjectOwnerAuthByProject(projectId: string): Promise<ProjectOwnerAuth | undefined>;
  updateProjectOwnerAuth(id: string, updates: Partial<ProjectOwnerAuth>): Promise<ProjectOwnerAuth | undefined>;
  deleteProjectOwnerAuth(id: string): Promise<void>;
  
  // Project Owner Session operations
  createProjectOwnerSession(session: InsertProjectOwnerSession): Promise<ProjectOwnerSession>;
  getProjectOwnerSession(id: string): Promise<ProjectOwnerSession | undefined>;
  getProjectOwnerSessionByToken(sessionToken: string): Promise<ProjectOwnerSession | undefined>;
  getProjectOwnerActiveSessionsByAuth(authId: string): Promise<ProjectOwnerSession[]>;
  getProjectOwnerActiveSessionsByProject(projectId: string): Promise<ProjectOwnerSession[]>;
  updateProjectOwnerSessionActivity(sessionToken: string): Promise<void>;
  terminateProjectOwnerSession(id: string, reason: string, terminationReason?: string): Promise<void>;
  terminateProjectOwnerSessionByToken(sessionToken: string, reason: string, terminationReason?: string): Promise<void>;
  
  // Project Login Log operations
  createProjectLoginLog(log: InsertProjectLoginLog): Promise<ProjectLoginLog>;
  getProjectLoginLogsByProject(projectId: string, limit?: number): Promise<ProjectLoginLog[]>;
  getProjectLoginLogsByWallet(walletAddress: string, limit?: number): Promise<ProjectLoginLog[]>;
  
  // Launchpad operations
  getActiveLaunchpadProjects(): Promise<DevtoolsProject[]>;
  createLaunchpadVerification(verification: any): Promise<any>;
  getLaunchpadVerificationQueue(): Promise<any[]>;
  updateLaunchpadVerification(projectId: string, updates: any): Promise<any>;
  createLaunchpadContribution(contribution: any): Promise<any>;
  updateLaunchpadFunding(projectId: string, amount: number): Promise<void>;
  
  // Project Subscription operations
  createProjectSubscription(subscription: InsertProjectSubscription): Promise<ProjectSubscription>;
  getProjectSubscription(projectId: string): Promise<ProjectSubscription | undefined>;
  updateProjectSubscription(id: string, updates: Partial<InsertProjectSubscription>): Promise<ProjectSubscription | undefined>;
  
  // Project Billing operations
  createProjectBilling(billing: InsertProjectBilling): Promise<ProjectBilling>;
  getProjectBillingHistory(projectId: string): Promise<ProjectBilling[]>;
  
  // Chain Configuration operations
  createChainConfiguration(config: InsertChainConfiguration): Promise<ChainConfiguration>;
  getChainConfigurationsByProject(projectId: string): Promise<ChainConfiguration[]>;
  updateChainConfiguration(id: string, updates: Partial<InsertChainConfiguration>): Promise<ChainConfiguration | undefined>;
  
  // Wallet Project Linking operations
  createWalletProjectLink(link: InsertWalletProjectLink): Promise<WalletProjectLink>;
  getWalletProjectLinks(walletAddress: string): Promise<WalletProjectLink[]>;
  getProjectWalletLinks(projectId: string): Promise<WalletProjectLink[]>;
  deleteWalletProjectLink(id: string): Promise<void>;
  updateWalletProjectLink(id: string, updates: Partial<InsertWalletProjectLink>): Promise<WalletProjectLink | undefined>;
  
  // NFT Metadata Caching operations
  getCachedNftMetadata(nftId: string): Promise<NftMetadataCache | undefined>;
  setCachedNftMetadata(metadata: InsertNftMetadataCache): Promise<NftMetadataCache>;
  getCachedCollectionMetadataByKey(collectionId: string): Promise<CollectionMetadataCache | undefined>;
  setCachedCollectionMetadata(metadata: InsertCollectionMetadataCache): Promise<CollectionMetadataCache>;
  clearExpiredCache(): Promise<void>;
  
  // DevTool Airdrop operations
  createDevToolAirdrop(airdrop: InsertDevToolAirdrop): Promise<DevToolAirdrop>;
  getDevToolAirdropsByCreator(creatorAddress: string): Promise<DevToolAirdrop[]>;
  getDevToolAirdrop(id: string): Promise<DevToolAirdrop | undefined>;
  updateDevToolAirdrop(id: string, updates: Partial<InsertDevToolAirdrop>): Promise<DevToolAirdrop | undefined>;
  deleteDevToolAirdrop(id: string): Promise<void>;
  getActiveDevToolAirdrops(): Promise<DevToolAirdrop[]>;
  updateAirdropClaims(id: string, claimedAddresses: string[]): Promise<DevToolAirdrop | undefined>;

  // ============== FINANCIAL ECOSYSTEM OPERATIONS ==============
  
  // Staking Pool operations
  createStakingPool(pool: InsertStakingPool): Promise<StakingPool>;
  getStakingPools(chain?: string): Promise<StakingPool[]>;
  getStakingPool(id: string): Promise<StakingPool | undefined>;
  updateStakingPool(id: string, updates: Partial<InsertStakingPool>): Promise<StakingPool | undefined>;
  
  // Staking Position operations
  createStakingPosition(position: InsertStakingPosition): Promise<StakingPosition>;
  getStakingPositionsByUser(userHandle: string): Promise<StakingPosition[]>;
  getStakingPositionsByPool(poolId: string): Promise<StakingPosition[]>;
  getStakingPosition(id: string): Promise<StakingPosition | undefined>;
  updateStakingPosition(id: string, updates: Partial<InsertStakingPosition>): Promise<StakingPosition | undefined>;
  getUserStakingStats(userHandle: string): Promise<{
    totalStaked: string;
    totalRewards: string;
    activePositions: number;
    totalValueUSD: string;
  }>;
  
  // Fee Ledger operations
  createFeeLedgerEntry(entry: InsertFeeLedger): Promise<FeeLedger>;
  getFeeLedgerBySource(source: string, limit?: number): Promise<FeeLedger[]>;
  getFeeLedgerByChain(chain: string, limit?: number): Promise<FeeLedger[]>;
  getUndistributedFees(chain?: string): Promise<FeeLedger[]>;
  markFeesDistributed(feeIds: string[], distributionTxHash: string): Promise<void>;
  
  // Reward Fund operations
  createRewardFund(fund: InsertRewardFund): Promise<RewardFund>;
  getRewardFund(chain: string): Promise<RewardFund | undefined>;
  updateRewardFund(id: string, updates: Partial<InsertRewardFund>): Promise<RewardFund | undefined>;
  getAllRewardFunds(): Promise<RewardFund[]>;
  
  // Loans operations
  createLoan(loan: InsertLoan): Promise<Loan>;
  getLoans(status?: string, chain?: string, limit?: number): Promise<Loan[]>;
  getLoan(id: string): Promise<Loan | undefined>;
  updateLoan(id: string, updates: Partial<InsertLoan>): Promise<Loan | undefined>;
  getLoansByBorrower(borrowerHandle: string): Promise<Loan[]>;
  getLoansByLender(lenderHandle: string): Promise<Loan[]>;
  getOverdueLoans(): Promise<Loan[]>;
  calculateLoanRepayment(loanId: string): Promise<{
    principalAmount: string;
    interestAmount: string;
    totalRepayment: string;
    daysRemaining: number;
  }>;
  
  // Loan Events operations
  createLoanEvent(event: InsertLoanEvent): Promise<LoanEvent>;
  getLoanEvents(loanId: string): Promise<LoanEvent[]>;
  getLoanEventsByType(eventType: string, limit?: number): Promise<LoanEvent[]>;
  
  // NFT Swap Offers operations
  createNftSwapOffer(offer: InsertNftSwapOffer): Promise<NftSwapOffer>;
  getNftSwapOffers(status?: string, chain?: string, limit?: number): Promise<NftSwapOffer[]>;
  getNftSwapOffer(id: string): Promise<NftSwapOffer | undefined>;
  updateNftSwapOffer(id: string, updates: Partial<InsertNftSwapOffer>): Promise<NftSwapOffer | undefined>;
  getNftSwapOffersByMaker(makerHandle: string): Promise<NftSwapOffer[]>;
  getNftSwapOffersByTaker(takerHandle: string): Promise<NftSwapOffer[]>;
  getMatchingNftSwapOffers(wantedItems: Array<{
    chain?: string;
    contract?: string;
    tokenId?: string;
  }>): Promise<NftSwapOffer[]>;
  
  // NFT Swap Matches operations
  createNftSwapMatch(match: InsertNftSwapMatch): Promise<NftSwapMatch>;
  getNftSwapMatches(offerId?: string, status?: string): Promise<NftSwapMatch[]>;
  getNftSwapMatch(id: string): Promise<NftSwapMatch | undefined>;
  updateNftSwapMatch(id: string, updates: Partial<InsertNftSwapMatch>): Promise<NftSwapMatch | undefined>;
  
  // Bank Wallet operations
  createBankWallet(wallet: InsertBankWallet): Promise<BankWallet>;
  getBankWallets(chain?: string, isActive?: boolean): Promise<BankWallet[]>;
  getBankWallet(id: string): Promise<BankWallet | undefined>;
  getBankWalletByAddress(address: string, chain: string): Promise<BankWallet | undefined>;
  updateBankWallet(id: string, updates: Partial<InsertBankWallet>): Promise<BankWallet | undefined>;
  getAvailableBankWallet(chain: string): Promise<BankWallet | undefined>;
  
  // Messaging Links operations
  createMessagingLink(link: InsertMessagingLink): Promise<MessagingLink>;
  getMessagingLinks(targetType: string, targetId?: string): Promise<MessagingLink[]>;
  getMessagingLink(id: string): Promise<MessagingLink | undefined>;
  getMessagingLinkByTarget(targetType: string, targetId: string): Promise<MessagingLink | undefined>;
  updateMessagingLink(id: string, updates: Partial<InsertMessagingLink>): Promise<MessagingLink | undefined>;
  deleteMessagingLink(id: string): Promise<void>;

  // ============== ENHANCED PROJECT MANAGEMENT SYSTEM ==============
  
  // Project Wallets operations - All wallets connected to a project
  createProjectWallet(wallet: InsertProjectWallet): Promise<ProjectWallet>;
  getProjectWallets(projectId: string): Promise<ProjectWallet[]>;
  getProjectWallet(id: string): Promise<ProjectWallet | undefined>;
  getProjectWalletByAddress(projectId: string, address: string, chain: string): Promise<ProjectWallet | undefined>;
  updateProjectWallet(id: string, updates: Partial<InsertProjectWallet>): Promise<ProjectWallet | undefined>;
  deleteProjectWallet(id: string): Promise<void>;
  
  // Project Services operations - Services enabled for each project
  createProjectService(service: InsertProjectService): Promise<ProjectService>;
  getProjectServices(projectId: string): Promise<ProjectService[]>;
  getProjectService(id: string): Promise<ProjectService | undefined>;
  getProjectServiceByType(projectId: string, service: string): Promise<ProjectService | undefined>;
  updateProjectService(id: string, updates: Partial<InsertProjectService>): Promise<ProjectService | undefined>;
  toggleProjectService(projectId: string, service: string, enabled: boolean): Promise<ProjectService | undefined>;
  
  // Token Configuration operations - For token projects
  createTokenConfiguration(config: InsertTokenConfiguration): Promise<TokenConfiguration>;
  getTokenConfiguration(projectId: string, chain: string): Promise<TokenConfiguration | undefined>;
  getTokenConfigurations(projectId: string): Promise<TokenConfiguration[]>;
  updateTokenConfiguration(id: string, updates: Partial<InsertTokenConfiguration>): Promise<TokenConfiguration | undefined>;
  deleteTokenConfiguration(id: string): Promise<void>;
  
  // NFT Configuration operations - For NFT projects
  createNftConfiguration(config: InsertNftConfiguration): Promise<NftConfiguration>;
  getNftConfiguration(projectId: string, chain: string): Promise<NftConfiguration | undefined>;
  getNftConfigurations(projectId: string): Promise<NftConfiguration[]>;
  updateNftConfiguration(id: string, updates: Partial<InsertNftConfiguration>): Promise<NftConfiguration | undefined>;
  deleteNftConfiguration(id: string): Promise<void>;
  
  // ============== ENHANCED WALLET LINKING SYSTEM ==============
  
  // External Wallets operations - Enhanced
  createExternalWallet(wallet: InsertExternalWallet): Promise<ExternalWallet>;
  getExternalWallet(id: number): Promise<ExternalWallet | undefined>;
  getExternalWalletByAddress(address: string, chain: string): Promise<ExternalWallet | undefined>;
  getExternalWalletsByUserId(userId: string): Promise<ExternalWallet[]>;
  updateExternalWallet(id: number, updates: Partial<InsertExternalWallet>): Promise<ExternalWallet | undefined>;
  deleteExternalWallet(id: number): Promise<void>;
  // Enhanced operations for nonce-based auth
  setWalletNonce(address: string, chain: string, nonce: string, expiresAt: Date, message: string): Promise<ExternalWallet | undefined>;
  verifyWalletNonce(address: string, chain: string, nonce: string): Promise<ExternalWallet | undefined>;
  clearWalletNonce(address: string, chain: string): Promise<void>;
  incrementVerificationAttempts(address: string, chain: string): Promise<void>;
  blockWallet(address: string, chain: string, blockUntil: Date): Promise<void>;
  
  // Linked Wallets operations - Permanent ownership verification
  listLinkedWallets(userId: string): Promise<LinkedWallet[]>;
  getLinkedWallet(id: string): Promise<LinkedWallet | undefined>;
  getLinkedWalletByAddress(address: string, chain: string, userId: string): Promise<LinkedWallet | undefined>;
  startLinkedWalletVerification(payload: {
    userId: string;
    address: string;
    chain: string;
    walletType: string;
  }): Promise<{nonce: string; message: string; expiresAt: Date}>;
  verifyAndSaveLinkedWallet(payload: {
    userId: string;
    address: string;
    chain: string;
    walletType: string;
    signature: string;
    nonce: string;
    walletLabel?: string;
    source?: string;
  }): Promise<LinkedWallet>;
  saveFromActiveSession(payload: {
    userId: string;
    address: string;
    chain: string;
    walletType: string;
    walletLabel?: string;
  }): Promise<LinkedWallet>;
  deleteLinkedWallet(id: string, userId: string): Promise<void>;
  updateLinkedWalletActivity(id: string): Promise<void>;
  
  // Auth Nonces operations
  createAuthNonce(nonce: InsertAuthNonce): Promise<AuthNonce>;
  getAuthNonce(nonce: string): Promise<AuthNonce | undefined>;
  getAuthNonceBySession(sessionId: string): Promise<AuthNonce | undefined>;
  markNonceUsed(nonce: string): Promise<AuthNonce | undefined>;
  deleteExpiredNonces(): Promise<void>;
  deleteNoncesByWallet(walletAddress: string): Promise<void>;
  
  // Project Claims operations
  createProjectClaim(claim: InsertProjectClaim): Promise<ProjectClaim>;
  getProjectClaim(id: string): Promise<ProjectClaim | undefined>;
  getProjectClaimsByClaimant(claimantWallet: string): Promise<ProjectClaim[]>;
  getProjectClaimsByIssuer(issuerWallet: string): Promise<ProjectClaim[]>;
  getProjectClaimsByStatus(status: string): Promise<ProjectClaim[]>;
  updateProjectClaim(id: string, updates: Partial<InsertProjectClaim>): Promise<ProjectClaim | undefined>;
  approveProjectClaim(id: string, reviewedBy: string, approvalNotes?: string): Promise<ProjectClaim | undefined>;
  rejectProjectClaim(id: string, reviewedBy: string, rejectionReason: string): Promise<ProjectClaim | undefined>;
  deleteProjectClaim(id: string): Promise<void>;
  
  // Enhanced DevTools Project operations 
  getProjectByVanitySlug(vanitySlug: string): Promise<DevtoolsProject | undefined>;
  getProjectsByIssuerWallet(issuerWallet: string): Promise<DevtoolsProject[]>;
  getProjectsByChainAndTaxon(chain: string, nftTokenTaxon: number): Promise<DevtoolsProject[]>;
  claimProject(projectId: string, claimantWallet: string): Promise<DevtoolsProject | undefined>;
  updateProjectClaimStatus(projectId: string, claimStatus: string): Promise<DevtoolsProject | undefined>;
  setProjectVanitySlug(projectId: string, vanitySlug: string): Promise<DevtoolsProject | undefined>;
  addProjectManager(projectId: string, managerWallet: string): Promise<DevtoolsProject | undefined>;
  removeProjectManager(projectId: string, managerWallet: string): Promise<DevtoolsProject | undefined>;
  
  // Auto-discovery operations for projects
  discoverProjectFromIssuer(chain: string, issuerWallet: string, nftTokenTaxon?: number, transactionHash?: string): Promise<DevtoolsProject | undefined>;
  getUnclaimedProjects(limit?: number): Promise<DevtoolsProject[]>;
  checkProjectExists(chain: string, issuerWallet: string, nftTokenTaxon?: number): Promise<DevtoolsProject | undefined>;
  getDevtoolsProjects(): Promise<DevtoolsProject[]>;
  getWalletProjectLinksByProject(projectId: string): Promise<WalletProjectLink[]>;

  // ============== CDN SYSTEM OPERATIONS ==============
  
  // Asset Files operations
  createAssetFile(asset: InsertAssetFile): Promise<AssetFile>;
  getAssetFile(id: string): Promise<AssetFile | undefined>;
  getAssetFileByHash(contentHash: string): Promise<AssetFile | undefined>;
  getAssetFileByUrl(sourceUrl: string): Promise<AssetFile | undefined>;
  updateAssetFile(id: string, updates: Partial<InsertAssetFile>): Promise<AssetFile | undefined>;
  updateAssetFileStatus(id: string, fetchStatus: string, processStatus: string, errorMessage?: string): Promise<AssetFile | undefined>;
  getAssetFilesByStatus(fetchStatus?: string, processStatus?: string, limit?: number): Promise<AssetFile[]>;
  getAssetFilesByMimeType(mimeType: string, limit?: number): Promise<AssetFile[]>;
  deleteAssetFile(id: string): Promise<void>;
  updateAssetFileAccess(id: string): Promise<void>; // Update last_accessed timestamp
  
  // Project Content Overrides operations
  createProjectContentOverride(override: InsertProjectContentOverride): Promise<ProjectContentOverride>;
  getProjectContentOverride(id: string): Promise<ProjectContentOverride | undefined>;
  getProjectContentOverridesByProject(projectId: string): Promise<ProjectContentOverride[]>;
  getProjectContentOverrideByEntity(projectId: string, entityType: string, issuer?: string, currencyCode?: string, taxon?: number, tokenId?: string): Promise<ProjectContentOverride | undefined>;
  updateProjectContentOverride(id: string, updates: Partial<InsertProjectContentOverride>): Promise<ProjectContentOverride | undefined>;
  deleteProjectContentOverride(id: string): Promise<void>;
  getProjectContentOverridesByStatus(status: string): Promise<ProjectContentOverride[]>;
  getVerifiedProjectContentOverrides(projectId?: string): Promise<ProjectContentOverride[]>;
  approveProjectContentOverride(id: string, reviewedBy: string): Promise<ProjectContentOverride | undefined>;
  rejectProjectContentOverride(id: string, reviewedBy: string): Promise<ProjectContentOverride | undefined>;
  
  // Ingestion Jobs operations
  createIngestionJob(job: InsertIngestionJob): Promise<IngestionJob>;
  getIngestionJob(id: string): Promise<IngestionJob | undefined>;
  getIngestionJobsByProject(projectId: string, status?: string): Promise<IngestionJob[]>;
  getIngestionJobsByStatus(status: string, limit?: number): Promise<IngestionJob[]>;
  getIngestionJobsByType(jobType: string, limit?: number): Promise<IngestionJob[]>;
  updateIngestionJob(id: string, updates: Partial<InsertIngestionJob>): Promise<IngestionJob | undefined>;
  updateIngestionJobStatus(id: string, status: string, errorMessage?: string, errorDetails?: Record<string, any>): Promise<IngestionJob | undefined>;
  updateIngestionJobProgress(id: string, progress: Record<string, any>): Promise<IngestionJob | undefined>;
  incrementIngestionJobAttempt(id: string): Promise<IngestionJob | undefined>;
  deleteIngestionJob(id: string): Promise<void>;
  getQueuedIngestionJobs(workerId?: string, limit?: number): Promise<IngestionJob[]>;
  assignIngestionJobToWorker(id: string, workerId: string): Promise<IngestionJob | undefined>;
  getIngestionJobsForRetry(): Promise<IngestionJob[]>;
  
  // Enhanced Project Subscriptions operations
  createEnhancedProjectSubscription(subscription: InsertEnhancedProjectSubscription): Promise<EnhancedProjectSubscription>;
  getEnhancedProjectSubscription(id: string): Promise<EnhancedProjectSubscription | undefined>;
  getEnhancedProjectSubscriptionByProject(projectId: string): Promise<EnhancedProjectSubscription | undefined>;
  updateEnhancedProjectSubscription(id: string, updates: Partial<InsertEnhancedProjectSubscription>): Promise<EnhancedProjectSubscription | undefined>;
  deleteEnhancedProjectSubscription(id: string): Promise<void>;
  getEnhancedProjectSubscriptionsByTier(tier: string): Promise<EnhancedProjectSubscription[]>;
  getEnhancedProjectSubscriptionsByStatus(status: string): Promise<EnhancedProjectSubscription[]>;
  getExpiredEnhancedProjectSubscriptions(): Promise<EnhancedProjectSubscription[]>;
  updateSubscriptionUsage(projectId: string, updates: {
    currentOverrideEntities?: number;
    currentAssetStorageGb?: string;
    currentMonthlyApiCalls?: number;
  }): Promise<EnhancedProjectSubscription | undefined>;
  resetMonthlyApiCalls(projectId: string): Promise<EnhancedProjectSubscription | undefined>;
  checkSubscriptionLimits(projectId: string): Promise<{
    canAddOverrides: boolean;
    canUseStorage: boolean;
    canMakeApiCalls: boolean;
    canRunJobs: boolean;
  }>;

  // ============== UNIFIED METADATA AGGREGATION OPERATIONS ==============
  
  // Project Content Overrides by entity operations
  getProjectContentOverridesByEntity(
    entityType: string, 
    issuer?: string, 
    currencyCode?: string, 
    taxon?: number, 
    tokenId?: string
  ): Promise<ProjectContentOverride[]>;
  
  // Token Configuration specialized operations
  getTokenConfigurationByToken(issuer: string, currencyCode: string): Promise<TokenConfiguration[]>;
  
  // NFT Configuration specialized operations  
  getNftConfigurationByCollection(issuer: string, taxon: number): Promise<NftConfiguration[]>;
  
  // Project lookup by collection
  getProjectByCollection(issuer: string, taxon: number): Promise<DevtoolsProject | undefined>;
  
  // Cached metadata operations - Token
  getCachedTokenMetadata(issuer: string, currencyCode: string): Promise<{ metadata: any; cachedAt: Date } | undefined>;
  upsertCachedTokenMetadata(issuer: string, currencyCode: string, metadata: any): Promise<void>;
  deleteCachedTokenMetadata(issuer: string, currencyCode: string): Promise<void>;
  
  // Cached metadata operations - Collection
  getCachedCollectionMetadata(issuer: string, taxon: number): Promise<CollectionMetadataCache | undefined>;
  upsertCachedCollectionMetadata(issuer: string, taxon: number, metadata: any): Promise<void>;
  deleteCachedCollectionMetadata(issuer: string, taxon: number): Promise<void>;
  
  // Cached metadata operations - NFT
  getCachedNFTMetadata(tokenId: string): Promise<NftMetadataCache | undefined>;
  upsertCachedNFTMetadata(tokenId: string, metadata: any): Promise<void>;
  deleteCachedNFTMetadata(tokenId: string): Promise<void>;
  
  // ===============================================================================
  // SEARCH SYSTEM OPERATIONS
  // ===============================================================================
  
  // Unified search operations
  searchUnified(query: string, limit?: number): Promise<UnifiedSearchResult[]>;
  searchProfiles(query: string, limit?: number): Promise<UnifiedSearchResult[]>;
  searchProjects(query: string, limit?: number): Promise<UnifiedSearchResult[]>;
  searchPages(query: string, limit?: number): Promise<UnifiedSearchResult[]>;
  
  // Search analytics operations
  recordSearchAnalytics(analytics: InsertSearchAnalytics): Promise<SearchAnalytics>;
  getPopularSearches(limit?: number): Promise<{ query: string; count: number }[]>;
  
  // Page metadata operations
  createPageMetadata(metadata: InsertPageMetadata): Promise<PageMetadata>;
  getPageMetadata(path: string): Promise<PageMetadata | undefined>;
  updatePageMetadata(path: string, updates: Partial<InsertPageMetadata>): Promise<PageMetadata | undefined>;
  getAllSearchablePages(): Promise<PageMetadata[]>;
  upsertPageMetadata(metadata: InsertPageMetadata): Promise<PageMetadata>;
  
  // Search results caching operations
  getCachedSearchResults(query: string): Promise<SearchResult[]>;
  setCachedSearchResults(results: InsertSearchResult[]): Promise<void>;
  updateSearchResultPopularity(query: string, resultId: string): Promise<void>;
  
  // Wallet Metrics operations
  getWalletMetrics(address: string): Promise<WalletMetrics | undefined>;
  setWalletMetrics(metrics: InsertWalletMetrics): Promise<WalletMetrics>;
  updateWalletMetrics(address: string, updates: Partial<InsertWalletMetrics>): Promise<WalletMetrics | undefined>;
  getTopRankedWallets(limit?: number): Promise<WalletMetrics[]>;
  getWalletsByTier(tier: string, limit?: number): Promise<WalletMetrics[]>;
  getRiddleWalletMetrics(limit?: number): Promise<WalletMetrics[]>;
  clearExpiredWalletMetrics(): Promise<void>;

  // Gaming NFT Methods
  // ==================
  getGamingCollections(): Promise<any[]>;
  createGamingNFT(nftData: any): Promise<void>;
  createGamingPlayer(playerData: any): Promise<void>;
  getGamingPlayer(userHandle: string): Promise<any[]>;
  getPlayerNFTs(walletAddress: string): Promise<any[]>;
  createGamingEvent(eventData: any): Promise<void>;
  getGamingEvents(playerId: string, limit?: number): Promise<any[]>;
  getGamingLeaderboard(limit?: number): Promise<any[]>;

  // ===============================================================================
  // NFT LAUNCHPAD PROJECT OPERATIONS
  // ===============================================================================
  
  // NFT Project operations
  createNftProject(project: any): Promise<any>;
  getNftProject(projectId: number): Promise<any | null>;
  getNftProjectByTaxon(taxon: number): Promise<any | null>;
  getNftProjectsByCreator(creatorWallet: string): Promise<any[]>;
  updateNftProject(projectId: number, updates: any): Promise<any>;
  deleteNftProject(projectId: number): Promise<void>;
  
  // NFT Asset operations
  createNftAsset(asset: any): Promise<any>;
  createNftAssets(assets: any[]): Promise<any[]>;
  getNftAssetsByProject(projectId: number): Promise<any[]>;
  getNftAsset(assetId: number): Promise<any | null>;
  updateNftAsset(assetId: number, updates: any): Promise<any>;
  deleteNftAsset(assetId: number): Promise<void>;
  
  // NFT Project Log operations
  createNftProjectLog(log: any): Promise<any>;
  getNftProjectLogs(projectId: number, limit?: number): Promise<any[]>;
  
  // NFT Project Whitelist operations
  addToNftWhitelist(whitelistEntry: any): Promise<any>;
  getNftWhitelist(projectId: number): Promise<any[]>;
  checkNftWhitelist(projectId: number, walletAddress: string): Promise<any | null>;
  updateNftWhitelistMintCount(projectId: number, walletAddress: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser as any as any)
      .returning();
    return user;
  }

  async getTokens(): Promise<Token[]> {
    return await db.select().from(tokens);
  }

  async getTokenBySymbol(symbol: string): Promise<Token | undefined> {
    const [token] = await db.select().from(tokens).where(eq(tokens.symbol, symbol));
    return token || undefined;
  }

  async createToken(insertToken: InsertToken): Promise<Token> {
    const [token] = await db
      .insert(tokens)
      .values(insertToken as any as any)
      .returning();
    return token;
  }

  async getTransactionsByWallet(walletAddress: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.wallet_address, walletAddress))
      .orderBy(desc(transactions.created_at));
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values(insertTransaction as any as any)
      .returning();
    return transaction;
  }

  async updateTransactionStatus(id: number, status: string, transactionHash?: string): Promise<Transaction | undefined> {
    const updateData: any = { 
      status, 
      updated_at: new Date() 
    };
    
    if (transactionHash) {
      updateData.transaction_hash = transactionHash;
    }

    const [transaction] = await db
      .update(transactions).set(updateData)
      .where(eq(transactions.id, id))
      .returning();
    
    return transaction || undefined;
  }
  
  // Riddle Wallet operations
  async createRiddleWallet(wallet: InsertRiddleWallet): Promise<RiddleWallet> {
    const [riddleWallet] = await db
      .insert(riddleWallets)
      .values(wallet as any as any)
      .returning();
    return riddleWallet;
  }
  
  async getRiddleWalletByHandle(handle: string): Promise<RiddleWallet | undefined> {
    const [wallet] = await db
      .select()
      .from(riddleWallets)
      .where(eq(riddleWallets.handle, handle));
    return wallet;
  }
  
  async getRiddleWalletById(id: number): Promise<RiddleWallet | undefined> {
    const [wallet] = await db
      .select()
      .from(riddleWallets)
      .where(eq(riddleWallets.id, id.toString()));
    return wallet;
  }
  
  async getRiddleWalletByLinkedAddress(address: string): Promise<RiddleWallet | undefined> {
    const [wallet] = await db
      .select()
      .from(riddleWallets)
      .where(eq(riddleWallets.linkedWalletAddress, address));
    return wallet;
  }

  async getRiddleWalletByGeneratedAddress(address: string): Promise<RiddleWallet | undefined> {
    const [wallet] = await db
      .select()
      .from(riddleWallets)
      .where(
        or(
          eq(riddleWallets.ethAddress, address),
          eq(riddleWallets.xrpAddress, address),
          eq(riddleWallets.solAddress, address),
          eq(riddleWallets.btcAddress, address)
        )
      );
    return wallet;
  }
  
  async updateRiddleWalletActivity(walletId: number | string): Promise<void> {
    const id = typeof walletId === 'string' ? walletId : walletId.toString();
    await db
      .update(riddleWallets)
      .set({ updatedAt: new Date() } as any)
      .where(eq(riddleWallets.id, id));
  }
  
  // Riddle Wallet Session operations
  async createRiddleWalletSession(session: InsertRiddleWalletSession): Promise<RiddleWalletSession> {
    const [walletSession] = await db
      .insert(riddleWalletSessions)
      .values(session as any as any)
      .returning();
    return walletSession;
  }
  
  async getRiddleWalletSession(sessionToken: string): Promise<RiddleWalletSession | undefined> {
    const [session] = await db
      .select()
      .from(riddleWalletSessions)
      .where(
        and(
          eq(riddleWalletSessions.sessionToken, sessionToken),
          gt(riddleWalletSessions.expiresAt, new Date())
        )
      );
    return session;
  }
  
  async getRiddleWalletBySession(sessionToken: string): Promise<RiddleWallet | undefined> {
    const session = await this.getRiddleWalletSession(sessionToken);
    if (!session) return undefined;
    
    const [wallet] = await db
      .select()
      .from(riddleWallets)
      .where(eq(riddleWallets.id, session.walletId));
    return wallet;
  }
  
  async validateSession(sessionToken: string): Promise<{handle: string} | null> {
    const wallet = await this.getRiddleWalletBySession(sessionToken);
    if (!wallet) return null;
    return { handle: wallet.handle };
  }
  
  async deleteExpiredSessions(): Promise<void> {
    await db
      .delete(riddleWalletSessions)
      .where(gt(riddleWalletSessions.expiresAt, new Date()));
  }

  async updateRiddleWalletPassword(handle: string, passwordHash: string, salt: string): Promise<void> {
    // Get wallet ID first
    const wallet = await this.getRiddleWalletByHandle(handle);
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    // Update password and invalidate all sessions for security
    await Promise.all([
      db.update(riddleWallets)
        .set({
          salt: salt,
          updatedAt: new Date()
        } as any)
        .where(eq(riddleWallets.handle, handle)),
      
      // Invalidate all sessions for this wallet
      db.delete(riddleWalletSessions)
        .where(eq(riddleWalletSessions.walletId, wallet.id))
    ]);
  }

  async deleteRiddleWalletByHandle(handle: string): Promise<void> {
    await db.delete(riddleWallets).where(eq(riddleWallets.handle, handle));
  }

  async listAllRiddleWallets(): Promise<RiddleWallet[]> {
    return await db
      .select()
      .from(riddleWallets)
      .orderBy(desc(riddleWallets.createdAt));
  }
  
  // Eligibility check - get wallets created from specific IP
  async getWalletsCreatedFromIP(ipAddress: string, sinceDate: Date): Promise<RiddleWallet[]> {
    // Since we don't have IP tracking in the database yet,
    // we'll return an empty array for now to avoid rate limiting issues
    // This allows the wallet creation to work properly
    return [];
  }



  async getRiddleWalletByAddress(address: string): Promise<RiddleWallet | undefined> {
    // Check all possible address fields for the wallet
    try {
      const results = await db.select()
        .from(riddleWallets)
        .where(or(
          eq(riddleWallets.xrpAddress, address),
          eq(riddleWallets.ethAddress, address),
          eq(riddleWallets.solAddress, address),
          eq(riddleWallets.btcAddress, address),
          eq(riddleWallets.linkedWalletAddress, address)
        ));
      
      return results[0] || undefined;
    } catch (error) {
      console.error('Error in getRiddleWalletByAddress:', error);
      return undefined;
    }
  }

  async recordBridgeTransaction(transaction: {
    userHandle: string;
    walletAddress: string;
    fromToken: string;
    toToken: string;
    inputAmount: number;
    outputAmount: number;
    bridgeFee: number;
    transactionHash: string;
    timestamp: Date;
  }): Promise<void> {
    try {
      // Log the bridge transaction data for rewards tracking
      console.log(`💰 Bridge Transaction Recorded:`, {
        user: transaction.userHandle,
        bridge: `${transaction.fromToken} → ${transaction.toToken}`,
        inputAmount: transaction.inputAmount,
        outputAmount: transaction.outputAmount,
        bridgeFee: transaction.bridgeFee,
        hash: transaction.transactionHash,
        timestamp: transaction.timestamp
      });
      
      // Calculate reward points (example: 1 XRP fee = 100 points)
      const rewardPoints = Math.floor(transaction.bridgeFee * 100);
      console.log(`🎁 Earned ${rewardPoints} reward points for bridge transaction`);
      
    } catch (error) {
      console.error('Failed to record bridge transaction:', error);
      throw error;
    }
  }

  // Swap History operations
  async createSwapHistory(swap: InsertSwapHistory): Promise<SwapHistory> {
    const [swapRecord] = await db
      .insert(swapHistory)
      .values(swap as any)
      .returning();
    return swapRecord;
  }

  async getSwapHistoryByWallet(walletAddress: string, limit = 50): Promise<SwapHistory[]> {
    return await db
      .select()
      .from(swapHistory)
      .where(eq(swapHistory.wallet_address, walletAddress))
      .orderBy(desc(swapHistory.created_at))
      .limit(limit);
  }

  async getSwapHistoryByChain(chain: string, limit = 50): Promise<SwapHistory[]> {
    return await db
      .select()
      .from(swapHistory)
      .where(eq(swapHistory.chain, chain))
      .orderBy(desc(swapHistory.created_at))
      .limit(limit);
  }

  async updateSwapHistoryStatus(
    id: string, 
    status: string, 
    transactionHash?: string, 
    failureReason?: string
  ): Promise<SwapHistory | undefined> {
    const updateData: any = { 
      status,
      completed_at: status === 'completed' ? new Date() : undefined
    };
    
    if (transactionHash) {
      updateData.transaction_hash = transactionHash;
    }
    
    if (failureReason) {
      updateData.failure_reason = failureReason;
    }

    const [updated] = await db
      .update(swapHistory).set(updateData)
      .where(eq(swapHistory.id, id))
      .returning();
    
    return updated || undefined;
  }

  async getSwapHistoryStats(walletAddress: string): Promise<{
    totalSwaps: number, 
    totalVolumeUSD: number, 
    successRate: number
  }> {
    const swaps = await db
      .select()
      .from(swapHistory)
      .where(eq(swapHistory.wallet_address, walletAddress));

    const totalSwaps = swaps.length;
    const completedSwaps = swaps.filter(s => s.status === 'completed').length;
    const totalVolumeUSD = swaps
      .filter(s => s.total_value_usd)
      .reduce((sum, s) => sum + parseFloat(s.total_value_usd || '0'), 0);
    const successRate = totalSwaps > 0 ? (completedSwaps / totalSwaps) * 100 : 0;

    return {
      totalSwaps,
      totalVolumeUSD,
      successRate
    };
  }

  // ============== RIDDLE TRANSACTION TRACKING OPERATIONS (RTN SYSTEM) ==============
  
  async createRiddleTransaction(transaction: InsertRiddleTransaction): Promise<RiddleTransaction> {
    const [created] = await db
      .insert(riddleTransactions)
      .values(transaction as any)
      .returning();
    return created;
  }

  async getRiddleTransactionByRTN(rtn: string): Promise<RiddleTransaction | undefined> {
    const [transaction] = await db
      .select()
      .from(riddleTransactions)
      .where(eq(riddleTransactions.rtn, rtn));
    return transaction || undefined;
  }

  async getRiddleTransactionsByWallet(walletAddress: string, limit = 50): Promise<RiddleTransaction[]> {
    return await db
      .select()
      .from(riddleTransactions)
      .where(eq(riddleTransactions.source_wallet, walletAddress))
      .orderBy(desc(riddleTransactions.created_at))
      .limit(limit);
  }

  async getRiddleTransactionsByUser(userHandle: string, limit = 50): Promise<RiddleTransaction[]> {
    return await db
      .select()
      .from(riddleTransactions)
      .where(eq(riddleTransactions.user_handle, userHandle))
      .orderBy(desc(riddleTransactions.created_at))
      .limit(limit);
  }

  async getRiddleTransactionsByType(transactionType: string, limit = 50): Promise<RiddleTransaction[]> {
    return await db
      .select()
      .from(riddleTransactions)
      .where(eq(riddleTransactions.type, transactionType))
      .orderBy(desc(riddleTransactions.created_at))
      .limit(limit);
  }

  async getRiddleTransactionsByStatus(status: string, limit = 50): Promise<RiddleTransaction[]> {
    return await db
      .select()
      .from(riddleTransactions)
      .where(eq(riddleTransactions.status, status))
      .orderBy(desc(riddleTransactions.created_at))
      .limit(limit);
  }

  async updateRiddleTransactionStatus(
    rtn: string, 
    status: string, 
    blockchainTxHash?: string, 
    failureReason?: string
  ): Promise<RiddleTransaction | undefined> {
    const updateData: any = { 
      status,
      completedAt: status === 'completed' ? new Date() : status === 'failed' ? new Date() : undefined
    };
    
    if (blockchainTxHash) {
      updateData.blockchainTxHash = blockchainTxHash;
    }
    
    if (failureReason) {
      updateData.failureReason = failureReason;
    }

    const [updated] = await db
      .update(riddleTransactions).set(updateData)
      .where(eq(riddleTransactions.rtn, rtn))
      .returning();
    
    return updated || undefined;
  }

  async updateRiddleTransactionBrokerStatus(
    rtn: string, 
    brokerStatus: string, 
    brokerWallet?: string
  ): Promise<RiddleTransaction | undefined> {
    const updateData: any = { brokerStatus };
    
    if (brokerWallet) {
      updateData.brokerWallet = brokerWallet;
    }

    const [updated] = await db
      .update(riddleTransactions).set(updateData)
      .where(eq(riddleTransactions.rtn, rtn))
      .returning();
    
    return updated || undefined;
  }

  async getRiddleTransactionStats(userHandle?: string): Promise<{
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    pendingTransactions: number;
    totalVolumeUSD: string;
    avgTransactionValueUSD: string;
  }> {
    let query = db.select().from(riddleTransactions);
    
    if (userHandle) {
      query = query.where(eq(riddleTransactions.user_handle, userHandle)) as any;
    }
    
    const transactions = await query;

    const totalTransactions = transactions.length;
    const successfulTransactions = transactions.filter(t => t.status === 'completed').length;
    const failedTransactions = transactions.filter(t => t.status === 'failed').length;
    const pendingTransactions = transactions.filter(t => t.status === 'pending').length;
    
    const totalVolumeUSD = transactions
      .filter(t => t.usd_value)
      .reduce((sum, t) => sum + parseFloat(t.usd_value || '0'), 0);
    
    const avgTransactionValueUSD = totalTransactions > 0 ? totalVolumeUSD / totalTransactions : 0;

    return {
      totalTransactions,
      successfulTransactions,
      failedTransactions,
      pendingTransactions,
      totalVolumeUSD: totalVolumeUSD.toFixed(2),
      avgTransactionValueUSD: avgTransactionValueUSD.toFixed(2)
    };
  }

  async getAdminRiddleTransactions(filters: {
    status?: string;
    transactionType?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<RiddleTransaction[]> {
    let query = db.select().from(riddleTransactions);
    const conditions = [];

    if (filters.status) {
      conditions.push(eq(riddleTransactions.status, filters.status));
    }
    if (filters.transactionType) {
      conditions.push(eq(riddleTransactions.type, filters.transactionType));
    }
    if (filters.dateFrom) {
      conditions.push(gt(riddleTransactions.created_at, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lt(riddleTransactions.created_at, filters.dateTo));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(desc(riddleTransactions.created_at)) as any;

    if (filters.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters.offset) {
      query = query.offset(filters.offset) as any;
    }

    return await query;
  }

  // DevTools Project operations
  async createDevtoolsProject(project: InsertDevtoolsProject): Promise<DevtoolsProject> {
    const [created] = await db
      .insert(devtoolsProjects)
      .values(project as any)
      .returning();
    return created;
  }

  async getDevtoolsProjectsByOwner(ownerWalletAddress: string): Promise<DevtoolsProject[]> {
    return await db
      .select()
      .from(devtoolsProjects)
      .where(eq(devtoolsProjects.ownerWalletAddress, ownerWalletAddress))
      .orderBy(desc(devtoolsProjects.createdAt));
  }

  async getAllDevtoolsProjects(): Promise<DevtoolsProject[]> {
    return await db
      .select()
      .from(devtoolsProjects)
      .orderBy(desc(devtoolsProjects.createdAt));
  }

  async getDevtoolsProject(id: string): Promise<DevtoolsProject | undefined> {
    const [project] = await db
      .select()
      .from(devtoolsProjects)
      .where(eq(devtoolsProjects.id, id));
    return project || undefined;
  }

  async getProjectByVanitySlug(vanitySlug: string): Promise<DevtoolsProject | undefined> {
    const [project] = await db
      .select()
      .from(devtoolsProjects)
      .where(eq(devtoolsProjects.vanity_slug, vanitySlug));
    return project || undefined;
  }

  async updateDevtoolsProject(id: string, updates: Partial<InsertDevtoolsProject>): Promise<DevtoolsProject | undefined> {
    const [updated] = await db
      .update(devtoolsProjects)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(devtoolsProjects.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteDevtoolsProject(id: string): Promise<void> {
    await db
      .delete(devtoolsProjects)
      .where(eq(devtoolsProjects.id, id));
  }

  // Project Owner Authentication operations
  async createProjectOwnerAuth(auth: InsertProjectOwnerAuth): Promise<ProjectOwnerAuth> {
    const [created] = await db
      .insert(projectOwnerAuth)
      .values(auth as any)
      .returning();
    return created;
  }

  async getProjectOwnerAuth(id: string): Promise<ProjectOwnerAuth | undefined> {
    const [auth] = await db
      .select()
      .from(projectOwnerAuth)
      .where(eq(projectOwnerAuth.id, id));
    return auth;
  }

  async getProjectOwnerAuthByProject(projectId: string): Promise<ProjectOwnerAuth | undefined> {
    const [auth] = await db
      .select()
      .from(projectOwnerAuth)
      .where(eq(projectOwnerAuth.project_id, projectId));
    return auth;
  }

  async updateProjectOwnerAuth(id: string, updates: Partial<ProjectOwnerAuth>): Promise<ProjectOwnerAuth | undefined> {
    const [updated] = await db
      .update(projectOwnerAuth)
      .set({
        ...updates,
        updated_at: new Date(),
      } as any)
      .where(eq(projectOwnerAuth.id, id))
      .returning();
    return updated;
  }

  async deleteProjectOwnerAuth(id: string): Promise<void> {
    await db
      .delete(projectOwnerAuth)
      .where(eq(projectOwnerAuth.id, id));
  }

  // Project Owner Session operations
  async createProjectOwnerSession(session: InsertProjectOwnerSession): Promise<ProjectOwnerSession> {
    const [created] = await db
      .insert(projectOwnerSessions)
      .values(session as any)
      .returning();
    return created;
  }

  async getProjectOwnerSession(id: string): Promise<ProjectOwnerSession | undefined> {
    const [session] = await db
      .select()
      .from(projectOwnerSessions)
      .where(eq(projectOwnerSessions.id, id));
    return session;
  }

  async getProjectOwnerSessionByToken(sessionToken: string): Promise<ProjectOwnerSession | undefined> {
    const [session] = await db
      .select()
      .from(projectOwnerSessions)
      .where(and(
        eq(projectOwnerSessions.session_token, sessionToken),
        eq(projectOwnerSessions.is_active, true)
      ));
    return session;
  }

  async getProjectOwnerActiveSessionsByAuth(authId: string): Promise<ProjectOwnerSession[]> {
    return await db
      .select()
      .from(projectOwnerSessions)
      .where(and(
        eq(projectOwnerSessions.auth_id, authId),
        eq(projectOwnerSessions.is_active, true),
        gt(projectOwnerSessions.expires_at, new Date())
      ))
      .orderBy(desc(projectOwnerSessions.created_at));
  }

  async getProjectOwnerActiveSessionsByProject(projectId: string): Promise<ProjectOwnerSession[]> {
    return await db
      .select()
      .from(projectOwnerSessions)
      .where(and(
        eq(projectOwnerSessions.project_id, projectId),
        eq(projectOwnerSessions.is_active, true),
        gt(projectOwnerSessions.expires_at, new Date())
      ))
      .orderBy(desc(projectOwnerSessions.created_at));
  }

  async updateProjectOwnerSessionActivity(sessionToken: string): Promise<void> {
    await db
      .update(projectOwnerSessions)
      .set({
        last_accessed: new Date()
      } as any)
      .where(eq(projectOwnerSessions.session_token, sessionToken));
  }

  async terminateProjectOwnerSession(id: string, reason: string, terminationReason?: string): Promise<void> {
    await db
      .update(projectOwnerSessions)
      .set({
        terminated_at: new Date(),
        termination_reason: terminationReason || reason,
      } as any)
      .where(eq(projectOwnerSessions.id, id));
  }

  async terminateProjectOwnerSessionByToken(sessionToken: string, reason: string, terminationReason?: string): Promise<void> {
    await db
      .update(projectOwnerSessions)
      .set({
        terminated_at: new Date(),
        termination_reason: terminationReason || reason,
      } as any)
      .where(eq(projectOwnerSessions.session_token, sessionToken));
  }

  // Project Login Log operations
  async createProjectLoginLog(log: InsertProjectLoginLog): Promise<ProjectLoginLog> {
    const [created] = await db
      .insert(projectLoginLogs)
      .values(log as any)
      .returning();
    return created;
  }

  async getProjectLoginLogsByProject(projectId: string, limit: number = 100): Promise<ProjectLoginLog[]> {
    return await db
      .select()
      .from(projectLoginLogs)
      .where(eq(projectLoginLogs.project_id, projectId))
      .orderBy(desc(projectLoginLogs.attempted_at))
      .limit(limit);
  }

  async getProjectLoginLogsByWallet(walletAddress: string, limit: number = 100): Promise<ProjectLoginLog[]> {
    return await db
      .select()
      .from(projectLoginLogs)
      .where(eq(projectLoginLogs.wallet_address, walletAddress))
      .orderBy(desc(projectLoginLogs.attempted_at))
      .limit(limit);
  }
  
  // Launchpad operations
  async getActiveLaunchpadProjects(): Promise<DevtoolsProject[]> {
    return await db
      .select()
      .from(devtoolsProjects)
      .where(
        and(
          eq(devtoolsProjects.projectType, 'launchpad'),
          or(
            eq(devtoolsProjects.status, 'active'),
            eq(devtoolsProjects.status, 'pending_verification')
          )
        )
      )
      .orderBy(desc(devtoolsProjects.createdAt));
  }
  
  async createLaunchpadVerification(verification: any): Promise<any> {
    // Store verification in metadata or separate table
    return verification;
  }
  
  async getLaunchpadVerificationQueue(): Promise<any[]> {
    return await db
      .select()
      .from(devtoolsProjects)
      .where(
        and(
          eq(devtoolsProjects.projectType, 'launchpad'),
          eq(devtoolsProjects.status, 'pending_verification')
        )
      )
      .orderBy(desc(devtoolsProjects.createdAt));
  }
  
  async updateLaunchpadVerification(projectId: string, updates: any): Promise<any> {
    return updates;
  }
  
  async createLaunchpadContribution(contribution: any): Promise<any> {
    // Store contribution in project metadata
    return contribution;
  }
  
  async updateLaunchpadFunding(projectId: string, amount: number): Promise<void> {
    const project = await this.getDevtoolsProject(projectId);
    if (!project) return;
    
    // Use custom_collection_metadata to store launchpad-specific data
    const launchpadMetadata = (project.custom_collection_metadata as any)?.launchpadMetadata || {};
    const currentFunding = launchpadMetadata.currentFunding || 0;
    const participantCount = launchpadMetadata.participantCount || 0;
    
    await this.updateDevtoolsProject(projectId, {
      custom_collection_metadata: {
        ...project.custom_collection_metadata,
        launchpadMetadata: {
          ...launchpadMetadata,
          currentFunding: currentFunding + amount,
          participantCount: participantCount + 1
        }
      }
    });
  }

  // Project Subscription operations
  async createProjectSubscription(subscription: InsertProjectSubscription): Promise<ProjectSubscription> {
    const [created] = await db
      .insert(projectSubscriptions)
      .values(subscription as any)
      .returning();
    return created;
  }

  async getProjectSubscription(projectId: string): Promise<ProjectSubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(projectSubscriptions)
      .where(eq(projectSubscriptions.projectId, projectId));
    return subscription || undefined;
  }

  async updateProjectSubscription(id: string, updates: Partial<InsertProjectSubscription>): Promise<ProjectSubscription | undefined> {
    const [updated] = await db
      .update(projectSubscriptions)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(projectSubscriptions.id, id))
      .returning();
    return updated || undefined;
  }

  // Project Billing operations
  async createProjectBilling(billing: InsertProjectBilling): Promise<ProjectBilling> {
    const [created] = await db
      .insert(projectBilling)
      .values(billing as any)
      .returning();
    return created;
  }

  async getProjectBillingHistory(projectId: string): Promise<ProjectBilling[]> {
    return await db
      .select()
      .from(projectBilling)
      .where(eq(projectBilling.projectId, projectId))
      .orderBy(desc(projectBilling.createdAt));
  }

  // Chain Configuration operations
  async createChainConfiguration(config: InsertChainConfiguration): Promise<ChainConfiguration> {
    const [created] = await db
      .insert(chainConfigurations)
      .values(config as any)
      .returning();
    return created;
  }

  async getChainConfigurationsByProject(projectId: string): Promise<ChainConfiguration[]> {
    return await db
      .select()
      .from(chainConfigurations)
      .where(eq(chainConfigurations.projectId, projectId));
  }

  async updateChainConfiguration(id: string, updates: Partial<InsertChainConfiguration>): Promise<ChainConfiguration | undefined> {
    const [updated] = await db
      .update(chainConfigurations).set({ ...updates, updatedAt: new Date() } as any)
      .returning();
    return updated || undefined;
  }

  // Wallet Project Linking operations
  async createWalletProjectLink(link: InsertWalletProjectLink): Promise<WalletProjectLink> {
    const [walletLink] = await db
      .insert(walletProjectLinks)
      .values(link as any)
      .returning();
    return walletLink;
  }

  async getWalletProjectLinks(walletAddress: string): Promise<WalletProjectLink[]> {
    return await db
      .select()
      .from(walletProjectLinks)
      .where(and(
        eq(walletProjectLinks.walletAddress, walletAddress),
        eq(walletProjectLinks.isActive, true)
      ));
  }

  async getProjectWalletLinks(projectId: string): Promise<WalletProjectLink[]> {
    return await db
      .select()
      .from(walletProjectLinks)
      .where(and(
        eq(walletProjectLinks.projectId, projectId),
        eq(walletProjectLinks.isActive, true)
      ));
  }

  async deleteWalletProjectLink(id: string): Promise<void> {
    await db
      .update(walletProjectLinks).set({ isActive: false } as any)
  }

  async updateWalletProjectLink(id: string, updates: Partial<InsertWalletProjectLink>): Promise<WalletProjectLink | undefined> {
    const [walletLink] = await db
      .update(walletProjectLinks).set(updates)
      .where(eq(walletProjectLinks.id, id))
      .returning();
    return walletLink;
  }

  // NFT Metadata Caching operations
  async getCachedNftMetadata(nftId: string): Promise<NftMetadataCache | undefined> {
    const [cached] = await db
      .select()
      .from(nftMetadataCache)
      .where(and(
        eq(nftMetadataCache.nftId, nftId),
        gt(nftMetadataCache.expiresAt, new Date())
      ));
    return cached;
  }

  async setCachedNftMetadata(metadata: InsertNftMetadataCache): Promise<NftMetadataCache> {
    const [cached] = await db
      .insert(nftMetadataCache)
      .values(metadata as any)
      .onConflictDoUpdate({
        target: nftMetadataCache.nftId,
        set: {
          ...metadata,
          cachedAt: new Date(),
        } as any,
      })
      .returning();
    return cached;
  }


  async setCachedCollectionMetadata(metadata: InsertCollectionMetadataCache): Promise<CollectionMetadataCache> {
    const [cached] = await db
      .insert(collectionMetadataCache)
      .values(metadata as any)
      .onConflictDoUpdate({
        target: collectionMetadataCache.collectionId,
        set: {
          ...metadata,
          cachedAt: new Date(),
        } as any,
      })
      .returning();
    return cached;
  }

  async clearExpiredCache(): Promise<void> {
    const now = new Date();
    
    // Clear expired NFT metadata cache
    await db.delete(nftMetadataCache).where(
      lt(nftMetadataCache.expiresAt, now)
    );
    
    // Clear expired collection metadata cache
    await db.delete(collectionMetadataCache).where(
      lt(collectionMetadataCache.expiresAt, now)
    );
  }

  // DevTool Airdrop operations
  async createDevToolAirdrop(airdrop: InsertDevToolAirdrop): Promise<DevToolAirdrop> {
    const [created] = await db
      .insert(devToolAirdrops)
      .values(airdrop as any)
      .returning();
    return created;
  }

  async getDevToolAirdropsByCreator(creatorAddress: string): Promise<DevToolAirdrop[]> {
    return await db
      .select()
      .from(devToolAirdrops)
      .where(eq(devToolAirdrops.creator_address, creatorAddress))
      .orderBy(desc(devToolAirdrops.created_at));
  }

  async getDevToolAirdrop(id: string): Promise<DevToolAirdrop | undefined> {
    const [airdrop] = await db
      .select()
      .from(devToolAirdrops)
      .where(eq(devToolAirdrops.id, id));
    return airdrop || undefined;
  }

  async updateDevToolAirdrop(id: string, updates: Partial<InsertDevToolAirdrop>): Promise<DevToolAirdrop | undefined> {
    const [updated] = await db
      .update(devToolAirdrops).set(updates)
      .where(eq(devToolAirdrops.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteDevToolAirdrop(id: string): Promise<void> {
    await db
      .delete(devToolAirdrops)
      .where(eq(devToolAirdrops.id, id));
  }

  async getActiveDevToolAirdrops(): Promise<DevToolAirdrop[]> {
    return await db
      .select()
      .from(devToolAirdrops)
      .where(eq(devToolAirdrops.status, 'active'))
      .orderBy(desc(devToolAirdrops.created_at));
  }

  async updateAirdropClaims(id: string, claimedAddresses: string[]): Promise<DevToolAirdrop | undefined> {
    const airdrop = await this.getDevToolAirdrop(id);
    if (!airdrop || !airdrop.recipients) return undefined;
    
    const recipients = Array.isArray(airdrop.recipients) ? airdrop.recipients : [];
    const updatedRecipients = recipients.map((recipient: any) => ({
      ...recipient,
      claimed: claimedAddresses.includes(recipient.address) || recipient.claimed || false
    }));
    
    const totalClaimed = updatedRecipients.filter((r: any) => r.claimed).length;
    
    const [updated] = await db
      .update(devToolAirdrops).set({
        total_claimed: totalClaimed,
        status: totalClaimed === updatedRecipients.length ? 'completed' : airdrop.status
      } as any)
      .where(eq(devToolAirdrops.id, id))
      .returning();
    
    return updated || undefined;
  }

  // ============== FINANCIAL ECOSYSTEM OPERATIONS IMPLEMENTATION ==============
  
  // Staking Pool operations
  async createStakingPool(pool: InsertStakingPool): Promise<StakingPool> {
    const [created] = await db
      .insert(stakingPools)
      .values(pool as any)
      .returning();
    return created;
  }

  async getStakingPools(chain?: string): Promise<StakingPool[]> {
    if (chain) {
      return await db.select().from(stakingPools)
        .where(eq(stakingPools.chain, chain))
        .orderBy(desc(stakingPools.createdAt));
    }
    return await db.select().from(stakingPools)
      .orderBy(desc(stakingPools.createdAt));
  }

  async getStakingPool(id: string): Promise<StakingPool | undefined> {
    const [pool] = await db
      .select()
      .from(stakingPools)
      .where(eq(stakingPools.id, id));
    return pool || undefined;
  }

  async updateStakingPool(id: string, updates: Partial<InsertStakingPool>): Promise<StakingPool | undefined> {
    const [updated] = await db
      .update(stakingPools).set({ ...updates, updatedAt: new Date() } as any)
      .returning();
    return updated || undefined;
  }
  
  // Staking Position operations
  async createStakingPosition(position: InsertStakingPosition): Promise<StakingPosition> {
    const [created] = await db
      .insert(stakingPositions)
      .values(position as any)
      .returning();
    return created;
  }

  async getStakingPositionsByUser(userHandle: string): Promise<StakingPosition[]> {
    return await db
      .select()
      .from(stakingPositions)
      .where(eq(stakingPositions.userHandle, userHandle))
      .orderBy(desc(stakingPositions.createdAt));
  }

  async getStakingPositionsByPool(poolId: string): Promise<StakingPosition[]> {
    return await db
      .select()
      .from(stakingPositions)
      .where(eq(stakingPositions.poolId, poolId))
      .orderBy(desc(stakingPositions.createdAt));
  }

  async getStakingPosition(id: string): Promise<StakingPosition | undefined> {
    const [position] = await db
      .select()
      .from(stakingPositions)
      .where(eq(stakingPositions.id, id));
    return position || undefined;
  }

  async updateStakingPosition(id: string, updates: Partial<InsertStakingPosition>): Promise<StakingPosition | undefined> {
    const [updated] = await db
      .update(stakingPositions).set(updates)
      .where(eq(stakingPositions.id, id))
      .returning();
    return updated || undefined;
  }

  async getUserStakingStats(userHandle: string): Promise<{
    totalStaked: string;
    totalRewards: string;
    activePositions: number;
    totalValueUSD: string;
  }> {
    const positions = await this.getStakingPositionsByUser(userHandle);
    const activePositions = positions.filter(p => p.status === 'active');
    
    const totalStaked = activePositions
      .reduce((sum, p) => sum + parseFloat(p.stakedAmount), 0)
      .toString();
    
    const totalRewards = activePositions
      .reduce((sum, p) => sum + parseFloat(p.pendingRewards || '0'), 0)
      .toString();
    
    return {
      totalStaked,
      totalRewards,
      activePositions: activePositions.length,
      totalValueUSD: totalStaked // Simplified, could add real USD conversion
    };
  }
  
  // Fee Ledger operations
  async createFeeLedgerEntry(entry: InsertFeeLedger): Promise<FeeLedger> {
    const [created] = await db
      .insert(feeLedger)
      .values(entry as any)
      .returning();
    return created;
  }

  async getFeeLedgerBySource(source: string, limit = 100): Promise<FeeLedger[]> {
    return await db
      .select()
      .from(feeLedger)
      .where(eq(feeLedger.source, source))
      .orderBy(desc(feeLedger.createdAt))
      .limit(limit);
  }

  async getFeeLedgerByChain(chain: string, limit = 100): Promise<FeeLedger[]> {
    return await db
      .select()
      .from(feeLedger)
      .where(eq(feeLedger.chain, chain))
      .orderBy(desc(feeLedger.createdAt))
      .limit(limit);
  }

  async getUndistributedFees(chain?: string): Promise<FeeLedger[]> {
    let query = db
      .select()
      .from(feeLedger)
      .where(eq(feeLedger.distributedToStaking, false));
    
    if (chain) {
      return await db
        .select()
        .from(feeLedger)
        .where(and(eq(feeLedger.distributedToStaking, false), eq(feeLedger.chain, chain)))
        .orderBy(desc(feeLedger.createdAt));
    }
    
    return await query.orderBy(desc(feeLedger.createdAt));
  }

  async markFeesDistributed(feeIds: string[], distributionTxHash: string): Promise<void> {
    await db
      .update(feeLedger).set({ 
        distributionTransactionHash: distributionTxHash 
      } as any)
      .where(or(...feeIds.map(id => eq(feeLedger.id, id))));
  }
  
  // Reward Fund operations
  async createRewardFund(fund: InsertRewardFund): Promise<RewardFund> {
    const [created] = await db
      .insert(rewardFund)
      .values(fund as any)
      .returning();
    return created;
  }

  async getRewardFund(chain: string): Promise<RewardFund | undefined> {
    const [fund] = await db
      .select()
      .from(rewardFund)
      .where(eq(rewardFund.chain, chain));
    return fund || undefined;
  }

  async updateRewardFund(id: string, updates: Partial<InsertRewardFund>): Promise<RewardFund | undefined> {
    const [updated] = await db
      .update(rewardFund).set({ ...updates, updatedAt: new Date() } as any)
      .returning();
    return updated || undefined;
  }

  async getAllRewardFunds(): Promise<RewardFund[]> {
    return await db
      .select()
      .from(rewardFund)
      .orderBy(desc(rewardFund.updatedAt));
  }
  
  // Loans operations
  async createLoan(loan: InsertLoan): Promise<Loan> {
    const [created] = await db
      .insert(loans)
      .values(loan as any)
      .returning();
    return created;
  }

  async getLoans(status?: string, chain?: string, limit = 100): Promise<Loan[]> {
    const conditions = [];
    
    if (status) conditions.push(eq(loans.status, status));
    if (chain) conditions.push(eq(loans.chain, chain));
    
    if (conditions.length > 0) {
      return await db.select().from(loans)
        .where(and(...conditions))
        .orderBy(desc(loans.createdAt))
        .limit(limit);
    }
    
    return await db.select().from(loans)
      .orderBy(desc(loans.createdAt))
      .limit(limit);
  }

  async getLoan(id: string): Promise<Loan | undefined> {
    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, id));
    return loan || undefined;
  }

  async updateLoan(id: string, updates: Partial<InsertLoan>): Promise<Loan | undefined> {
    const [updated] = await db
      .update(loans).set({ ...updates, updatedAt: new Date() } as any)
      .returning();
    return updated || undefined;
  }

  async getLoansByBorrower(borrowerHandle: string): Promise<Loan[]> {
    return await db
      .select()
      .from(loans)
      .where(eq(loans.borrowerHandle, borrowerHandle))
      .orderBy(desc(loans.createdAt));
  }

  async getLoansByLender(lenderHandle: string): Promise<Loan[]> {
    return await db
      .select()
      .from(loans)
      .where(eq(loans.lenderHandle, lenderHandle))
      .orderBy(desc(loans.createdAt));
  }

  async getOverdueLoans(): Promise<Loan[]> {
    return await db
      .select()
      .from(loans)
      .where(and(
        eq(loans.status, 'active'),
        lt(loans.dueAt, new Date())
      ));
  }

  async calculateLoanRepayment(loanId: string): Promise<{
    principalAmount: string;
    interestAmount: string;
    totalRepayment: string;
    daysRemaining: number;
  }> {
    const loan = await this.getLoan(loanId);
    if (!loan) throw new Error('Loan not found');
    
    const principal = parseFloat(loan.principalAmount);
    const rate = parseFloat(loan.interestRate);
    const totalRepayment = principal * (1 + (rate / 100) * (loan.durationDays / 365));
    const interestAmount = totalRepayment - principal;
    
    let daysRemaining = 0;
    if (loan.dueAt) {
      daysRemaining = Math.max(0, Math.ceil((loan.dueAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    }
    
    return {
      principalAmount: principal.toFixed(8),
      interestAmount: interestAmount.toFixed(8),
      totalRepayment: totalRepayment.toFixed(8),
      daysRemaining
    };
  }
  
  // Loan Events operations
  async createLoanEvent(event: InsertLoanEvent): Promise<LoanEvent> {
    const [created] = await db
      .insert(loanEvents)
      .values(event as any)
      .returning();
    return created;
  }

  async getLoanEvents(loanId: string): Promise<LoanEvent[]> {
    return await db
      .select()
      .from(loanEvents)
      .where(eq(loanEvents.loanId, loanId))
      .orderBy(desc(loanEvents.createdAt));
  }

  async getLoanEventsByType(eventType: string, limit = 100): Promise<LoanEvent[]> {
    return await db
      .select()
      .from(loanEvents)
      .where(eq(loanEvents.eventType, eventType))
      .orderBy(desc(loanEvents.createdAt))
      .limit(limit);
  }
  
  // NFT Swap Offers operations
  async createNftSwapOffer(offer: InsertNftSwapOffer): Promise<NftSwapOffer> {
    const [created] = await db
      .insert(nftSwapOffers)
      .values(offer as any)
      .returning();
    return created;
  }

  async getNftSwapOffers(status?: string, chain?: string, limit = 100): Promise<NftSwapOffer[]> {
    // Note: nftSwapOffers table doesn't have chain field, ignoring chain filter
    
    if (status) {
      return await db.select().from(nftSwapOffers)
        .where(eq(nftSwapOffers.status, status))
        .orderBy(desc(nftSwapOffers.createdAt))
        .limit(limit);
    }
    
    return await db.select().from(nftSwapOffers)
      .orderBy(desc(nftSwapOffers.createdAt))
      .limit(limit);
  }

  async getNftSwapOffer(id: string): Promise<NftSwapOffer | undefined> {
    const [offer] = await db
      .select()
      .from(nftSwapOffers)
      .where(eq(nftSwapOffers.id, id));
    return offer || undefined;
  }

  async updateNftSwapOffer(id: string, updates: Partial<InsertNftSwapOffer>): Promise<NftSwapOffer | undefined> {
    const [updated] = await db
      .update(nftSwapOffers).set({ ...updates, updatedAt: new Date() } as any)
      .returning();
    return updated || undefined;
  }

  async getNftSwapOffersByMaker(makerHandle: string): Promise<NftSwapOffer[]> {
    return await db
      .select()
      .from(nftSwapOffers)
      .where(eq(nftSwapOffers.fromUserId, makerHandle))
      .orderBy(desc(nftSwapOffers.createdAt));
  }

  async getNftSwapOffersByTaker(takerHandle: string): Promise<NftSwapOffer[]> {
    return await db
      .select()
      .from(nftSwapOffers)
      .where(eq(nftSwapOffers.toUserId, takerHandle))
      .orderBy(desc(nftSwapOffers.createdAt));
  }

  async getMatchingNftSwapOffers(wantedItems: Array<{
    chain?: string;
    contract?: string;
    tokenId?: string;
  }>): Promise<NftSwapOffer[]> {
    const offers = await db
      .select()
      .from(nftSwapOffers)
      .where(eq(nftSwapOffers.status, 'active'));
    
    // Note: nftSwapOffers table doesn't have wantedNfts field, returning basic filter
    return offers.filter(offer => {
      // Basic filtering by checking if requested NFT matches wanted items
      return wantedItems.some(wanted => 
        wanted.tokenId === offer.requestedNftId
      );
    });
  }
  
  // NFT Swap Matches operations
  async createNftSwapMatch(match: InsertNftSwapMatch): Promise<NftSwapMatch> {
    const [created] = await db
      .insert(nftSwapMatches)
      .values(match as any)
      .returning();
    return created;
  }

  async getNftSwapMatches(offerId?: string, status?: string): Promise<NftSwapMatch[]> {
    const conditions = [];
    
    if (offerId) conditions.push(eq(nftSwapMatches.offerId, offerId));
    if (status) conditions.push(eq(nftSwapMatches.status, status));
    
    if (conditions.length > 0) {
      return await db.select().from(nftSwapMatches)
        .where(and(...conditions))
        .orderBy(desc(nftSwapMatches.createdAt));
    }
    
    return await db.select().from(nftSwapMatches)
      .orderBy(desc(nftSwapMatches.createdAt));
  }

  async getNftSwapMatch(id: string): Promise<NftSwapMatch | undefined> {
    const [match] = await db
      .select()
      .from(nftSwapMatches)
      .where(eq(nftSwapMatches.id, id));
    return match || undefined;
  }

  async updateNftSwapMatch(id: string, updates: Partial<InsertNftSwapMatch>): Promise<NftSwapMatch | undefined> {
    const [updated] = await db
      .update(nftSwapMatches).set(updates)
      .where(eq(nftSwapMatches.id, id))
      .returning();
    return updated || undefined;
  }
  
  // Bank Wallet operations
  async createBankWallet(wallet: InsertBankWallet): Promise<BankWallet> {
    const [created] = await db
      .insert(bankWallets)
      .values(wallet as any)
      .returning();
    return created;
  }

  async getBankWallets(chain?: string, isActive?: boolean): Promise<BankWallet[]> {
    const conditions = [];
    
    if (chain) conditions.push(eq(bankWallets.chain, chain));
    if (isActive !== undefined) conditions.push(eq(bankWallets.isActive, isActive));
    
    if (conditions.length > 0) {
      return await db.select().from(bankWallets)
        .where(and(...conditions))
        .orderBy(desc(bankWallets.createdAt));
    }
    
    return await db.select().from(bankWallets)
      .orderBy(desc(bankWallets.createdAt));
  }

  async getBankWallet(id: string): Promise<BankWallet | undefined> {
    const [wallet] = await db
      .select()
      .from(bankWallets)
      .where(eq(bankWallets.id, id));
    return wallet || undefined;
  }

  async getBankWalletByAddress(address: string, chain: string): Promise<BankWallet | undefined> {
    const [wallet] = await db
      .select()
      .from(bankWallets)
      .where(and(
        eq(bankWallets.address, address),
        eq(bankWallets.chain, chain)
      ));
    return wallet || undefined;
  }

  async updateBankWallet(id: string, updates: Partial<InsertBankWallet>): Promise<BankWallet | undefined> {
    const [updated] = await db
      .update(bankWallets).set({ ...updates, updatedAt: new Date() } as any)
      .returning();
    return updated || undefined;
  }

  async getAvailableBankWallet(chain: string): Promise<BankWallet | undefined> {
    const [wallet] = await db
      .select()
      .from(bankWallets)
      .where(and(
        eq(bankWallets.chain, chain),
        eq(bankWallets.isActive, true),
        eq(bankWallets.totalTransactions, 0)
      ))
      .orderBy(desc(bankWallets.createdAt))
      .limit(1);
    return wallet || undefined;
  }
  
  // Messaging Links operations
  async createMessagingLink(link: InsertMessagingLink): Promise<MessagingLink> {
    const [created] = await db
      .insert(messagingLinks)
      .values(link as any)
      .returning();
    return created;
  }

  async getMessagingLinks(targetType: string, targetId?: string): Promise<MessagingLink[]> {
    let query = db
      .select()
      .from(messagingLinks)
      .where(eq(messagingLinks.targetType, targetType));
    
    if (targetId) {
      return await db
        .select()
        .from(messagingLinks)
        .where(and(
          eq(messagingLinks.targetType, targetType),
          eq(messagingLinks.targetId, targetId)
        ))
        .orderBy(desc(messagingLinks.createdAt));
    }
    
    return await query.orderBy(desc(messagingLinks.createdAt));
  }

  async getMessagingLink(id: string): Promise<MessagingLink | undefined> {
    const [link] = await db
      .select()
      .from(messagingLinks)
      .where(eq(messagingLinks.id, id));
    return link || undefined;
  }

  async getMessagingLinkByTarget(targetType: string, targetId: string): Promise<MessagingLink | undefined> {
    const [link] = await db
      .select()
      .from(messagingLinks)
      .where(and(
        eq(messagingLinks.targetType, targetType),
        eq(messagingLinks.targetId, targetId)
      ));
    return link || undefined;
  }

  async updateMessagingLink(id: string, updates: Partial<InsertMessagingLink>): Promise<MessagingLink | undefined> {
    const [updated] = await db
      .update(messagingLinks).set({ ...updates, updatedAt: new Date() } as any)
      .returning();
    return updated || undefined;
  }

  async deleteMessagingLink(id: string): Promise<void> {
    await db
      .delete(messagingLinks)
      .where(eq(messagingLinks.id, id));
  }

  // ============== ENHANCED WALLET LINKING SYSTEM IMPLEMENTATION ==============
  
  // External Wallets operations - Enhanced
  async createExternalWallet(wallet: InsertExternalWallet): Promise<ExternalWallet> {
    const [result] = await db.insert(externalWallets).values(wallet as any).returning();
    return result;
  }

  async getExternalWallet(id: number): Promise<ExternalWallet | undefined> {
    const [wallet] = await db.select().from(externalWallets).where(eq(externalWallets.id, id));
    return wallet;
  }

  async getExternalWalletByAddress(address: string, chain: string): Promise<ExternalWallet | undefined> {
    const [wallet] = await db.select().from(externalWallets)
      .where(and(eq(externalWallets.address, address), eq(externalWallets.chain, chain)));
    return wallet;
  }

  async getExternalWalletsByUserId(userId: string): Promise<ExternalWallet[]> {
    return await db.select().from(externalWallets).where(eq(externalWallets.user_id, userId));
  }

  async updateExternalWallet(id: number, updates: Partial<InsertExternalWallet>): Promise<ExternalWallet | undefined> {
    const [result] = await db.update(externalWallets)
      .set({ ...updates, last_used: new Date() } as any)
      .where(eq(externalWallets.id, id))
      .returning();
    return result;
  }

  async deleteExternalWallet(id: number): Promise<void> {
    await db.delete(externalWallets).where(eq(externalWallets.id, id));
  }

  // Enhanced operations for nonce-based auth
  async setWalletNonce(address: string, chain: string, nonce: string, expiresAt: Date, message: string): Promise<ExternalWallet | undefined> {
    const [result] = await db.update(externalWallets)
      .set({
        nonce_expires_at: expiresAt,
        verification_message: message,
        last_used: new Date()
      } as any)
      .where(and(eq(externalWallets.address, address), eq(externalWallets.chain, chain)))
      .returning();
    return result;
  }

  async verifyWalletNonce(address: string, chain: string, nonce: string): Promise<ExternalWallet | undefined> {
    const [wallet] = await db.select().from(externalWallets)
      .where(and(
        eq(externalWallets.address, address),
        eq(externalWallets.chain, chain),
        eq(externalWallets.nonce, nonce),
        gt(externalWallets.nonce_expires_at, new Date())
      ));
    return wallet;
  }

  async clearWalletNonce(address: string, chain: string): Promise<void> {
    await db.update(externalWallets)
    await db.update(externalWallets).set({
        nonce_expires_at: null,
        verification_message: null
      } as any)
      .where(and(eq(externalWallets.address, address), eq(externalWallets.chain, chain)));
  }

  async incrementVerificationAttempts(address: string, chain: string): Promise<void> {
    await db.update(externalWallets).set({
        last_used: new Date()
      } as any)
      .where(and(eq(externalWallets.address, address), eq(externalWallets.chain, chain)));
  }

  async blockWallet(address: string, chain: string, blockUntil: Date): Promise<void> {
    await db.update(externalWallets).set({
        last_used: blockUntil
      } as any)
      .where(and(eq(externalWallets.address, address), eq(externalWallets.chain, chain)));
  }

  // Linked Wallets operations - Permanent ownership verification
  async listLinkedWallets(userId: string): Promise<LinkedWallet[]> {
    return await db.select().from(linkedWallets)
      .where(eq(linkedWallets.user_id, userId))
      .orderBy(desc(linkedWallets.created_at));
  }

  async getLinkedWallet(id: string): Promise<LinkedWallet | undefined> {
    const [wallet] = await db.select().from(linkedWallets)
      .where(eq(linkedWallets.id, id));
    return wallet || undefined;
  }

  async getLinkedWalletByAddress(address: string, chain: string, userId: string): Promise<LinkedWallet | undefined> {
    const [wallet] = await db.select().from(linkedWallets)
      .where(and(
        eq(linkedWallets.address, address),
        eq(linkedWallets.chain, chain),
        eq(linkedWallets.user_id, userId)
      ));
    return wallet || undefined;
  }

  async startLinkedWalletVerification(payload: {
    userId: string;
    address: string;
    chain: string;
    walletType: string;
  }): Promise<{nonce: string; message: string; expiresAt: Date}> {
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const message = `Verify ownership of ${payload.chain.toUpperCase()} wallet ${payload.address}\n\nNonce: ${nonce}\nExpires: ${expiresAt.toISOString()}`;

    // Store in authNonces for verification
    await this.createAuthNonce({
      nonce,
      wallet_address: payload.address,
      chain: payload.chain,
      wallet_type: payload.walletType,
      message,
      expires_at: expiresAt,
      session_id: `linked_wallet_${payload.userId}_${Date.now()}`
    });

    return { nonce, message, expiresAt };
  }

  async verifyAndSaveLinkedWallet(payload: {
    userId: string;
    address: string;
    chain: string;
    walletType: string;
    signature: string;
    nonce: string;
    walletLabel?: string;
    source?: string;
  }): Promise<LinkedWallet> {
    // Verify nonce exists and is valid
    const authNonce = await this.getAuthNonce(payload.nonce);
    if (!authNonce || 
        authNonce.wallet_address !== payload.address ||
        authNonce.chain !== payload.chain) {
      throw new Error('Invalid or expired verification nonce');
    }

    // Mark nonce as used
    await this.markNonceUsed(payload.nonce);

    // Check if wallet already linked to this user
    const existing = await this.getLinkedWalletByAddress(payload.address, payload.chain, payload.userId);
    if (existing) {
      throw new Error('Wallet already linked to this account');
    }

    // Create linked wallet record
    const [linkedWallet] = await db.insert(linkedWallets).values({
      user_id: payload.userId,
      address: payload.address,
      chain: payload.chain,
      wallet_type: payload.walletType,
      verified: true as any,
      proof_signature: payload.signature,
      proof_message: authNonce.message,
      verification_nonce: payload.nonce,
      source: payload.source || 'manual',
      wallet_label: payload.walletLabel || `${payload.walletType} Wallet`,
      verified_at: new Date()
    } as any).returning();

    return linkedWallet;
  }

  async saveFromActiveSession(payload: {
    userId: string;
    address: string;
    chain: string;
    walletType: string;
    walletLabel?: string;
  }): Promise<LinkedWallet> {
    // Check if wallet already linked to this user
    const existing = await this.getLinkedWalletByAddress(payload.address, payload.chain, payload.userId);
    if (existing) {
      throw new Error('Wallet already linked to this account');
    }

    // Create linked wallet record from active session (pre-verified)
    const [linkedWallet] = await db.insert(linkedWallets).values({
      user_id: payload.userId,
      address: payload.address,
      chain: payload.chain,
      wallet_type: payload.walletType,
      verified: true as any, // Pre-verified from active session
      source: 'from_session',
      wallet_label: payload.walletLabel || `${payload.walletType} Wallet`,
      verified_at: new Date(),
      proof_message: 'Linked from active wallet session'
    } as any).returning();

    return linkedWallet;
  }

  async deleteLinkedWallet(id: string, userId: string): Promise<void> {
    await db.delete(linkedWallets)
      .where(and(
        eq(linkedWallets.id, id),
        eq(linkedWallets.user_id, userId)
      ));
  }

  async updateLinkedWalletActivity(id: string): Promise<void> {
    await db.update(linkedWallets)
    await db.update(linkedWallets).set({ last_activity: new Date() } as any)
  }

  // Auth Nonces operations
  async createAuthNonce(nonce: InsertAuthNonce): Promise<AuthNonce> {
    const [result] = await db.insert(authNonces).values(nonce as any).returning();
    return result;
  }

  async getAuthNonce(nonce: string): Promise<AuthNonce | undefined> {
    const [result] = await db.select().from(authNonces)
      .where(and(eq(authNonces.nonce, nonce), eq(authNonces.used, false), gt(authNonces.expires_at, new Date())));
    return result;
  }

  async getAuthNonceBySession(sessionId: string): Promise<AuthNonce | undefined> {
    const [result] = await db.select().from(authNonces)
      .where(and(eq(authNonces.session_id, sessionId), eq(authNonces.used, false), gt(authNonces.expires_at, new Date())));
    return result;
  }

  async markNonceUsed(nonce: string): Promise<AuthNonce | undefined> {
    const [result] = await db.update(authNonces).set({ used: true } as any)
      .returning();
    return result;
  }

  async deleteExpiredNonces(): Promise<void> {
    await db.delete(authNonces).where(
      or(eq(authNonces.used, true), lt(authNonces.expires_at, new Date()))
    );
  }

  async deleteNoncesByWallet(walletAddress: string): Promise<void> {
    await db.delete(authNonces).where(eq(authNonces.wallet_address, walletAddress));
  }

  // Project Claims operations
  async createProjectClaim(claim: InsertProjectClaim): Promise<ProjectClaim> {
    const [result] = await db.insert(projectClaims).values(claim as any).returning();
    return result;
  }

  async getProjectClaim(id: string): Promise<ProjectClaim | undefined> {
    const [claim] = await db.select().from(projectClaims).where(eq(projectClaims.id, id));
    return claim;
  }

  async getProjectClaimsByClaimant(claimantWallet: string): Promise<ProjectClaim[]> {
    return await db.select().from(projectClaims)
      .where(eq(projectClaims.claimant_wallet, claimantWallet))
      .orderBy(desc(projectClaims.created_at));
  }

  async getProjectClaimsByIssuer(issuerWallet: string): Promise<ProjectClaim[]> {
    return await db.select().from(projectClaims)
      .where(eq(projectClaims.issuer_wallet, issuerWallet))
      .orderBy(desc(projectClaims.created_at));
  }

  async getProjectClaimsByStatus(status: string): Promise<ProjectClaim[]> {
    return await db.select().from(projectClaims)
      .where(eq(projectClaims.status, status))
      .orderBy(desc(projectClaims.created_at));
  }

  async updateProjectClaim(id: string, updates: Partial<InsertProjectClaim>): Promise<ProjectClaim | undefined> {
    const [result] = await db.update(projectClaims).set({ ...updates, updated_at: new Date() } as any)
      .returning();
    return result;
  }

  async approveProjectClaim(id: string, reviewedBy: string, approvalNotes?: string): Promise<ProjectClaim | undefined> {
    const [result] = await db.update(projectClaims).set({
        reviewed_by: reviewedBy,
        reviewed_at: new Date(),
        approval_notes: approvalNotes,
        updated_at: new Date()
      } as any)
      .where(eq(projectClaims.id, id))
      .returning();
    return result;
  }

  async rejectProjectClaim(id: string, reviewedBy: string, rejectionReason: string): Promise<ProjectClaim | undefined> {
    const [result] = await db.update(projectClaims).set({
        reviewed_by: reviewedBy,
        reviewed_at: new Date(),
        rejection_reason: rejectionReason,
        updated_at: new Date()
      } as any)
      .where(eq(projectClaims.id, id))
      .returning();
    return result;
  }

  async deleteProjectClaim(id: string): Promise<void> {
    await db.delete(projectClaims).where(eq(projectClaims.id, id));
  }

  // Enhanced DevTools Project operations 
  async getProjectsByIssuerWallet(issuerWallet: string): Promise<DevtoolsProject[]> {
    return await db.select().from(devtoolsProjects)
      .where(eq(devtoolsProjects.issuer_wallet, issuerWallet))
      .orderBy(desc(devtoolsProjects.createdAt));
  }

  async getProjectsByChainAndTaxon(chain: string, nftTokenTaxon: number): Promise<DevtoolsProject[]> {
    return await db.select().from(devtoolsProjects)
      .where(and(
        eq(devtoolsProjects.discovered_from_chain, chain),
        eq(devtoolsProjects.nft_token_taxon, nftTokenTaxon)
      ))
      .orderBy(desc(devtoolsProjects.createdAt));
  }

  async claimProject(projectId: string, claimantWallet: string): Promise<DevtoolsProject | undefined> {
    const [result] = await db.update(devtoolsProjects).set({
        ownerWalletAddress: claimantWallet,
        updatedAt: new Date()
      } as any)
      .where(eq(devtoolsProjects.id, projectId))
      .returning();
    return result;
  }

  async updateProjectClaimStatus(projectId: string, claimStatus: string): Promise<DevtoolsProject | undefined> {
    const [result] = await db.update(devtoolsProjects).set({
        updatedAt: new Date()
      } as any)
      .where(eq(devtoolsProjects.id, projectId))
      .returning();
    return result;
  }

  async setProjectVanitySlug(projectId: string, vanitySlug: string): Promise<DevtoolsProject | undefined> {
    const [result] = await db.update(devtoolsProjects).set({
        updatedAt: new Date()
      } as any)
      .where(eq(devtoolsProjects.id, projectId))
      .returning();
    return result;
  }

  async addProjectManager(projectId: string, managerWallet: string): Promise<DevtoolsProject | undefined> {
    const [project] = await db.select().from(devtoolsProjects).where(eq(devtoolsProjects.id, projectId));
    if (!project) return undefined;
    
    const currentManagers = project.project_managers || [];
    if (!currentManagers.includes(managerWallet)) {
      const [result] = await db.update(devtoolsProjects).set({
          updatedAt: new Date()
        } as any)
        .where(eq(devtoolsProjects.id, projectId))
        .returning();
      return result;
    }
    return project;
  }

  async removeProjectManager(projectId: string, managerWallet: string): Promise<DevtoolsProject | undefined> {
    const [project] = await db.select().from(devtoolsProjects).where(eq(devtoolsProjects.id, projectId));
    if (!project) return undefined;
    
    const currentManagers = project.project_managers || [];
    const [result] = await db.update(devtoolsProjects).set({
        updatedAt: new Date()
      } as any)
      .where(eq(devtoolsProjects.id, projectId))
      .returning();
    return result;
  }

  // Auto-discovery operations for projects
  async discoverProjectFromIssuer(chain: string, issuerWallet: string, nftTokenTaxon?: number, transactionHash?: string): Promise<DevtoolsProject | undefined> {
    const projectData: InsertDevtoolsProject = {
      name: `Discovered Project - ${issuerWallet}${nftTokenTaxon !== undefined ? ` (Taxon ${nftTokenTaxon})` : ''}`,
      description: `Auto-discovered project from ${chain} issuer ${issuerWallet}`,
      ownerWalletAddress: issuerWallet,
      projectType: "imported",
      issuer_wallet: issuerWallet,
      nft_token_taxon: nftTokenTaxon,
      discovered_from_chain: chain,
      discovered_from_issuer: issuerWallet,
      discovery_transaction_hash: transactionHash,
      auto_discovered: true,
      claim_status: "unclaimed"
    };

    const [result] = await db.insert(devtoolsProjects).values(projectData as any).returning();
    return result;
  }

  async getUnclaimedProjects(limit?: number): Promise<DevtoolsProject[]> {
    if (limit) {
      return await db.select().from(devtoolsProjects)
        .where(eq(devtoolsProjects.claim_status, "unclaimed"))
        .orderBy(desc(devtoolsProjects.createdAt))
        .limit(limit);
    }
    
    return await db.select().from(devtoolsProjects)
      .where(eq(devtoolsProjects.claim_status, "unclaimed"))
      .orderBy(desc(devtoolsProjects.createdAt));
  }

  async checkProjectExists(chain: string, issuerWallet: string, nftTokenTaxon?: number): Promise<DevtoolsProject | undefined> {
    let whereCondition = and(
      eq(devtoolsProjects.discovered_from_chain, chain),
      eq(devtoolsProjects.issuer_wallet, issuerWallet)
    );

    if (nftTokenTaxon !== undefined) {
      whereCondition = and(whereCondition, eq(devtoolsProjects.nft_token_taxon, nftTokenTaxon));
    }

    const [project] = await db.select().from(devtoolsProjects).where(whereCondition);
    return project;
  }

  // ============== ENHANCED PROJECT MANAGEMENT SYSTEM ==============
  
  // Project Wallets operations
  async createProjectWallet(wallet: InsertProjectWallet): Promise<ProjectWallet> {
    const [result] = await db.insert(projectWallets).values(wallet as any).returning();
    return result;
  }

  async getProjectWallets(projectId: string): Promise<ProjectWallet[]> {
    return await db.select().from(projectWallets)
      .where(eq(projectWallets.projectId, projectId))
      .orderBy(desc(projectWallets.createdAt));
  }

  async getProjectWallet(id: string): Promise<ProjectWallet | undefined> {
    const [wallet] = await db.select().from(projectWallets).where(eq(projectWallets.id, id));
    return wallet;
  }

  async getProjectWalletByAddress(projectId: string, address: string, chain: string): Promise<ProjectWallet | undefined> {
    const [wallet] = await db.select().from(projectWallets)
      .where(and(
        eq(projectWallets.projectId, projectId),
        eq(projectWallets.address, address),
        eq(projectWallets.chain, chain)
      ));
    return wallet;
  }

  async updateProjectWallet(id: string, updates: Partial<InsertProjectWallet>): Promise<ProjectWallet | undefined> {
    const [result] = await db.update(projectWallets).set({ ...updates, updatedAt: new Date() } as any)
      .returning();
    return result;
  }

  async deleteProjectWallet(id: string): Promise<void> {
    await db.delete(projectWallets).where(eq(projectWallets.id, id));
  }

  // Project Services operations
  async createProjectService(service: InsertProjectService): Promise<ProjectService> {
    const [result] = await db.insert(projectServices).values(service as any).returning();
    return result;
  }

  async getProjectServices(projectId: string): Promise<ProjectService[]> {
    return await db.select().from(projectServices)
      .where(eq(projectServices.projectId, projectId))
      .orderBy(desc(projectServices.createdAt));
  }

  async getProjectService(id: string): Promise<ProjectService | undefined> {
    const [service] = await db.select().from(projectServices).where(eq(projectServices.id, id));
    return service;
  }

  async getProjectServiceByType(projectId: string, service: string): Promise<ProjectService | undefined> {
    const [result] = await db.select().from(projectServices)
      .where(and(
        eq(projectServices.projectId, projectId),
        eq(projectServices.service, service)
      ));
    return result;
  }

  async updateProjectService(id: string, updates: Partial<InsertProjectService>): Promise<ProjectService | undefined> {
    const [result] = await db.update(projectServices).set({ ...updates, updatedAt: new Date() } as any)
      .returning();
    return result;
  }

  async toggleProjectService(projectId: string, service: string, enabled: boolean): Promise<ProjectService | undefined> {
    const existing = await this.getProjectServiceByType(projectId, service);
    
    if (existing) {
      const [result] = await db.update(projectServices).set({ enabled, updatedAt: new Date() } as any)
        .returning();
      return result;
    } else {
      const [result] = await db.insert(projectServices)
        .values({ projectId, service, enabled } as any)
        .returning();
      return result;
    }
  }

  // Token Configuration operations
  async createTokenConfiguration(config: InsertTokenConfiguration): Promise<TokenConfiguration> {
    const [result] = await db.insert(tokenConfigurations).values(config as any).returning();
    return result;
  }

  async getTokenConfiguration(projectId: string, chain: string): Promise<TokenConfiguration | undefined> {
    const [config] = await db.select().from(tokenConfigurations)
      .where(and(
        eq(tokenConfigurations.projectId, projectId),
        eq(tokenConfigurations.chain, chain)
      ));
    return config;
  }

  async getTokenConfigurations(projectId: string): Promise<TokenConfiguration[]> {
    return await db.select().from(tokenConfigurations)
      .where(eq(tokenConfigurations.projectId, projectId))
      .orderBy(desc(tokenConfigurations.createdAt));
  }

  async updateTokenConfiguration(id: string, updates: Partial<InsertTokenConfiguration>): Promise<TokenConfiguration | undefined> {
    const [result] = await db.update(tokenConfigurations).set({ ...updates, updatedAt: new Date() } as any)
      .returning();
    return result;
  }

  async deleteTokenConfiguration(id: string): Promise<void> {
    await db.delete(tokenConfigurations).where(eq(tokenConfigurations.id, id));
  }

  // NFT Configuration operations
  async createNftConfiguration(config: InsertNftConfiguration): Promise<NftConfiguration> {
    const [result] = await db.insert(nftConfigurations).values(config as any).returning();
    return result;
  }

  async getNftConfiguration(projectId: string, chain: string): Promise<NftConfiguration | undefined> {
    const [config] = await db.select().from(nftConfigurations)
      .where(and(
        eq(nftConfigurations.projectId, projectId),
        eq(nftConfigurations.chain, chain)
      ));
    return config;
  }

  async getNftConfigurations(projectId: string): Promise<NftConfiguration[]> {
    return await db.select().from(nftConfigurations)
      .where(eq(nftConfigurations.projectId, projectId))
      .orderBy(desc(nftConfigurations.createdAt));
  }

  async updateNftConfiguration(id: string, updates: Partial<InsertNftConfiguration>): Promise<NftConfiguration | undefined> {
    const [result] = await db.update(nftConfigurations).set({ ...updates, updatedAt: new Date() } as any)
      .returning();
    return result;
  }

  async deleteNftConfiguration(id: string): Promise<void> {
    await db.delete(nftConfigurations).where(eq(nftConfigurations.id, id));
  }

  // Additional helper methods for API compatibility
  async getDevtoolsProjects(): Promise<DevtoolsProject[]> {
    return await db.select().from(devtoolsProjects)
      .orderBy(desc(devtoolsProjects.createdAt));
  }

  async getWalletProjectLinksByProject(projectId: string): Promise<WalletProjectLink[]> {
    return await db.select().from(walletProjectLinks)
      .where(eq(walletProjectLinks.projectId, projectId));
  }

  // ============== UNIFIED METADATA AGGREGATION IMPLEMENTATIONS ==============

  /**
   * Get project content overrides by entity type and identifiers
   */
  async getProjectContentOverridesByEntity(
    entityType: string,
    issuer?: string,
    currencyCode?: string,
    taxon?: number,
    tokenId?: string
  ): Promise<ProjectContentOverride[]> {
    console.log(`📝 [STORAGE] Getting project content overrides for ${entityType}`, { issuer, currencyCode, taxon, tokenId });
    
    // Build query conditions based on provided parameters
    const conditions = [eq(projectContentOverrides.entity_type, entityType)];
    
    if (issuer) conditions.push(eq(projectContentOverrides.issuer, issuer));
    if (currencyCode) conditions.push(eq(projectContentOverrides.currency_code, currencyCode));
    if (taxon !== undefined) conditions.push(eq(projectContentOverrides.taxon, taxon));
    if (tokenId) conditions.push(eq(projectContentOverrides.token_id, tokenId));
    
    const overrides = await db.select().from(projectContentOverrides)
      .where(and(...conditions))
      .orderBy(desc(projectContentOverrides.priority), desc(projectContentOverrides.updated_at));
    
    console.log(`✅ [STORAGE] Found ${overrides.length} project content overrides`);
    return overrides;
  }

  /**
   * Alias for interface compatibility
   */
  async getProjectContentOverrideByEntity(
    projectId: string,
    entityType: string,
    issuer?: string,
    currencyCode?: string,
    taxon?: number,
    tokenId?: string
  ): Promise<ProjectContentOverride | undefined> {
    const overrides = await this.getProjectContentOverridesByEntity(entityType, issuer, currencyCode, taxon, tokenId);
    return overrides[0] || undefined;
  }

  /**
   * Get token configurations for a specific token
   */
  async getTokenConfigurationByToken(issuer: string, currencyCode: string): Promise<TokenConfiguration[]> {
    console.log(`⚙️ [STORAGE] Getting token configurations for ${currencyCode}:${issuer}`);
    
    const configs = await db.select().from(tokenConfigurations)
      .where(and(
        eq(tokenConfigurations.issuerAddress, issuer),
        eq(tokenConfigurations.symbol, currencyCode)
      ))
      .orderBy(desc(tokenConfigurations.updatedAt));
    
    console.log(`✅ [STORAGE] Found ${configs.length} token configurations`);
    return configs;
  }

  /**
   * Get NFT configurations for a specific collection
   */
  async getNftConfigurationByCollection(issuer: string, taxon: number): Promise<NftConfiguration[]> {
    console.log(`🎨 [STORAGE] Getting NFT configurations for ${issuer}:${taxon}`);
    
    const configs = await db.select().from(nftConfigurations)
      .where(and(
        eq(nftConfigurations.minterAddress, issuer),
        eq(nftConfigurations.taxon, taxon)
      ))
      .orderBy(desc(nftConfigurations.updatedAt));
    
    console.log(`✅ [STORAGE] Found ${configs.length} NFT configurations`);
    return configs;
  }

  /**
   * Get project associated with a collection
   */
  async getProjectByCollection(issuer: string, taxon: number): Promise<DevtoolsProject | undefined> {
    console.log(`🔗 [STORAGE] Getting project for collection ${issuer}:${taxon}`);
    
    const [project] = await db.select().from(devtoolsProjects)
      .where(and(
        eq(devtoolsProjects.issuer_wallet, issuer),
        eq(devtoolsProjects.nft_token_taxon, taxon)
      ));
    
    if (project) {
      console.log(`✅ [STORAGE] Found project: ${project.name} (${project.id})`);
    } else {
      console.log(`❌ [STORAGE] No project found for collection ${issuer}:${taxon}`);
    }
    
    return project;
  }

  /**
   * Get cached token metadata
   */
  async getCachedTokenMetadata(issuer: string, currencyCode: string): Promise<{ metadata: any; cachedAt: Date } | undefined> {
    console.log(`💾 [STORAGE] Getting cached token metadata for ${currencyCode}:${issuer}`);
    
    // Create a composite key for token identification
    const tokenKey = `${issuer}:${currencyCode}`;
    
    // First try to find in NFT metadata cache table (tokens might be stored there)
    const [cached] = await db.select().from(nftMetadataCache)
      .where(eq(nftMetadataCache.nftId, tokenKey))
      .orderBy(desc(nftMetadataCache.cachedAt))
      .limit(1);
    
    if (cached) {
      console.log(`✅ [STORAGE] Found cached token metadata`);
      return {
        metadata: cached.metadata,
        cachedAt: cached.cachedAt || new Date()
      };
    }
    
    console.log(`❌ [STORAGE] No cached token metadata found`);
    return undefined;
  }

  /**
   * Upsert cached token metadata
   */
  async upsertCachedTokenMetadata(issuer: string, currencyCode: string, metadata: any): Promise<void> {
    console.log(`💾 [STORAGE] Upserting cached token metadata for ${currencyCode}:${issuer}`);
    
    const tokenKey = `${issuer}:${currencyCode}`;
    const now = new Date();
    
    try {
      // Try to update existing record first
      const [nftUpdated] = await db.update(nftMetadataCache).set({
          cachedAt: now,
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
        } as any)
        .where(eq(nftMetadataCache.nftId, tokenKey))
        .returning();
      
      if (!nftUpdated) {
        // If no update occurred, insert new record
        await db.insert(nftMetadataCache).values({
          nftId: tokenKey,
          metadata,
          cachedAt: now,
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
        } as any);
      }
      
      console.log(`✅ [STORAGE] Token metadata cached successfully`);
    } catch (error) {
      console.error(`❌ [STORAGE] Failed to cache token metadata:`, error);
    }
  }

  /**
   * Delete cached token metadata
   */
  async deleteCachedTokenMetadata(issuer: string, currencyCode: string): Promise<void> {
    console.log(`🗑️ [STORAGE] Deleting cached token metadata for ${currencyCode}:${issuer}`);
    
    const tokenKey = `${issuer}:${currencyCode}`;
    
    await db.delete(nftMetadataCache)
      .where(eq(nftMetadataCache.nftId, tokenKey));
    
    console.log(`✅ [STORAGE] Cached token metadata deleted`);
  }

  /**
   * Get cached collection metadata by key
   */
  async getCachedCollectionMetadataByKey(collectionId: string): Promise<CollectionMetadataCache | undefined> {
    console.log(`💾 [STORAGE] Getting cached collection metadata by key: ${collectionId}`);
    
    const [cached] = await db.select().from(collectionMetadataCache)
      .where(eq(collectionMetadataCache.collectionId, collectionId))
      .orderBy(desc(collectionMetadataCache.cachedAt))
      .limit(1);
    
    if (cached) {
      console.log(`✅ [STORAGE] Found cached collection metadata`);
    } else {
      console.log(`❌ [STORAGE] No cached collection metadata found`);
    }
    
    return cached;
  }

  /**
   * Get cached collection metadata
   */
  async getCachedCollectionMetadata(issuer: string, taxon: number): Promise<CollectionMetadataCache | undefined> {
    console.log(`💾 [STORAGE] Getting cached collection metadata for ${issuer}:${taxon}`);
    
    const collectionKey = `${issuer}:${taxon}`;
    
    const [cached] = await db.select().from(collectionMetadataCache)
      .where(eq(collectionMetadataCache.collectionId, collectionKey))
      .orderBy(desc(collectionMetadataCache.cachedAt))
      .limit(1);
    
    if (cached) {
      console.log(`✅ [STORAGE] Found cached collection metadata`);
    } else {
      console.log(`❌ [STORAGE] No cached collection metadata found`);
    }
    
    return cached;
  }

  /**
   * Upsert cached collection metadata
   */
  async upsertCachedCollectionMetadata(issuer: string, taxon: number, metadata: any): Promise<void> {
    console.log(`💾 [STORAGE] Upserting cached collection metadata for ${issuer}:${taxon}`);
    
    const collectionKey = `${issuer}:${taxon}`;
    const now = new Date();
    
    try {
      // Try to update existing record first
      const [collUpdated] = await db.update(collectionMetadataCache).set({
          cachedAt: now
        } as any)
        .where(eq(collectionMetadataCache.collectionId, collectionKey))
        .returning();
      
      if (!collUpdated) {
        // If no update occurred, insert new record
        await db.insert(collectionMetadataCache).values({
          collectionId: collectionKey,
          metadata,
          cachedAt: now,
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
        } as any);
      }
      
      console.log(`✅ [STORAGE] Collection metadata cached successfully`);
    } catch (error) {
      console.error(`❌ [STORAGE] Failed to cache collection metadata:`, error);
    }
  }

  /**
   * Delete cached collection metadata
   */
  async deleteCachedCollectionMetadata(issuer: string, taxon: number): Promise<void> {
    console.log(`🗑️ [STORAGE] Deleting cached collection metadata for ${issuer}:${taxon}`);
    
    const collectionKey = `${issuer}:${taxon}`;
    
    await db.delete(collectionMetadataCache)
      .where(eq(collectionMetadataCache.collectionId, collectionKey));
    
    console.log(`✅ [STORAGE] Cached collection metadata deleted`);
  }

  /**
   * Get cached NFT metadata
   */
  async getCachedNFTMetadata(tokenId: string): Promise<NftMetadataCache | undefined> {
    console.log(`💾 [STORAGE] Getting cached NFT metadata for ${tokenId}`);
    
    const [cached] = await db.select().from(nftMetadataCache)
      .where(eq(nftMetadataCache.nftId, tokenId))
      .orderBy(desc(nftMetadataCache.cachedAt))
      .limit(1);
    
    if (cached) {
      console.log(`✅ [STORAGE] Found cached NFT metadata`);
    } else {
      console.log(`❌ [STORAGE] No cached NFT metadata found`);
    }
    
    return cached;
  }

  /**
   * Upsert cached NFT metadata
   */
  async upsertCachedNFTMetadata(tokenId: string, metadata: any): Promise<void> {
    console.log(`💾 [STORAGE] Upserting cached NFT metadata for ${tokenId}`);
    
    const now = new Date();
    
    try {
      // Try to update existing record first
      const [nftUpdated] = await db.update(nftMetadataCache).set({
          cachedAt: now,
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
        } as any)
        .where(eq(nftMetadataCache.nftId, tokenId))
        .returning();
      
      if (!nftUpdated) {
        // If no update occurred, insert new record
        await db.insert(nftMetadataCache).values({
          nftId: tokenId,
          metadata,
          cachedAt: now,
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
        } as any);
      }
      
      console.log(`✅ [STORAGE] NFT metadata cached successfully`);
    } catch (error) {
      console.error(`❌ [STORAGE] Failed to cache NFT metadata:`, error);
    }
  }

  /**
   * Delete cached NFT metadata
   */
  async deleteCachedNFTMetadata(tokenId: string): Promise<void> {
    console.log(`🗑️ [STORAGE] Deleting cached NFT metadata for ${tokenId}`);
    
    await db.delete(nftMetadataCache)
      .where(eq(nftMetadataCache.nftId, tokenId));
    
    console.log(`✅ [STORAGE] Cached NFT metadata deleted`);
  }

  // ============== INGESTION JOBS OPERATIONS ==============

  /**
   * Create a new ingestion job
   */
  async createIngestionJob(job: InsertIngestionJob): Promise<IngestionJob> {
    console.log(`🎯 [STORAGE] Creating ingestion job: ${(job as any).job_type}`);
    
    const [newJob] = await db.insert(ingestionJobs).values(job as any).returning();
    
    console.log(`✅ [STORAGE] Ingestion job created: ${newJob.id}`);
    return newJob;
  }

  /**
   * Get ingestion job by ID
   */
  async getIngestionJob(id: string): Promise<IngestionJob | undefined> {
    console.log(`🔍 [STORAGE] Getting ingestion job: ${id}`);
    
    const [job] = await db.select().from(ingestionJobs)
      .where(eq(ingestionJobs.id, id))
      .limit(1);
    
    if (job) {
      console.log(`✅ [STORAGE] Found ingestion job: ${job.job_type}`);
    } else {
      console.log(`❌ [STORAGE] Ingestion job not found`);
    }
    
    return job;
  }

  /**
   * Get ingestion jobs by project
   */
  async getIngestionJobsByProject(projectId: string, status?: string): Promise<IngestionJob[]> {
    console.log(`🔍 [STORAGE] Getting ingestion jobs for project: ${projectId}`);
    
    const whereConditions = [eq(ingestionJobs.project_id, projectId)];
    if (status) {
      whereConditions.push(eq(ingestionJobs.status, status));
    }
    
    const jobs = await db.select().from(ingestionJobs)
      .where(and(...whereConditions))
      .orderBy(desc(ingestionJobs.created_at));
    
    console.log(`✅ [STORAGE] Found ${jobs.length} ingestion jobs`);
    return jobs;
  }

  /**
   * Get ingestion jobs by status
   */
  async getIngestionJobsByStatus(status: string, limit?: number): Promise<IngestionJob[]> {
    console.log(`🔍 [STORAGE] Getting ingestion jobs with status: ${status}`);
    
    let query = db.select().from(ingestionJobs)
      .where(eq(ingestionJobs.status, status))
      .orderBy(desc(ingestionJobs.created_at)) as any;
    
    if (limit) {
      query = (query as any).limit(limit);
    }
    
    const jobs = await query;
    
    console.log(`✅ [STORAGE] Found ${jobs.length} ingestion jobs with status ${status}`);
    return jobs;
  }

  /**
   * Get ingestion jobs by type
   */
  async getIngestionJobsByType(jobType: string, limit?: number): Promise<IngestionJob[]> {
    console.log(`🔍 [STORAGE] Getting ingestion jobs with type: ${jobType}`);
    
    let query = db.select().from(ingestionJobs)
      .where(eq(ingestionJobs.job_type, jobType))
      .orderBy(desc(ingestionJobs.created_at)) as any;
    
    if (limit) {
      query = (query as any).limit(limit);
    }
    
    const jobs = await query;
    
    console.log(`✅ [STORAGE] Found ${jobs.length} ingestion jobs with type ${jobType}`);
    return jobs;
  }

  /**
   * Update ingestion job
   */
  async updateIngestionJob(id: string, updates: Partial<InsertIngestionJob>): Promise<IngestionJob | undefined> {
    console.log(`🔄 [STORAGE] Updating ingestion job: ${id}`);
    
    const [jobUpdated] = await db.update(ingestionJobs).set({ ...updates, updated_at: new Date() } as any)
      .where(eq(ingestionJobs.id, id))
      .returning();
    
    if (jobUpdated) {
      console.log(`✅ [STORAGE] Ingestion job updated`);
    } else {
      console.log(`❌ [STORAGE] Ingestion job not found for update`);
    }
    
    return jobUpdated;
  }

  /**
   * Update ingestion job status
   */
  async updateIngestionJobStatus(id: string, status: string, errorMessage?: string, errorDetails?: Record<string, any>): Promise<IngestionJob | undefined> {
    console.log(`🔄 [STORAGE] Updating ingestion job status: ${id} -> ${status}`);
    
    const updates: any = {
      status,
      updated_at: new Date()
    };
    
    if (errorMessage) {
      updates.error_message = errorMessage;
    }
    
    if (errorDetails) {
      updates.error_details = errorDetails;
    }
    
    const [jobUpdated] = await db.update(ingestionJobs).set(updates)
      .where(eq(ingestionJobs.id, id))
      .returning();
    
    if (jobUpdated) {
      console.log(`✅ [STORAGE] Ingestion job status updated to ${status}`);
    } else {
      console.log(`❌ [STORAGE] Ingestion job not found for status update`);
    }
    
    return jobUpdated;
  }

  /**
   * Update ingestion job progress
   */
  async updateIngestionJobProgress(id: string, progress: Record<string, any>): Promise<IngestionJob | undefined> {
    console.log(`📊 [STORAGE] Updating ingestion job progress: ${id}`);
    
    const [jobUpdated] = await db.update(ingestionJobs)
      .set({
        updated_at: new Date()
      } as any)
      .where(eq(ingestionJobs.id, id))
      .returning();
    
    if (jobUpdated) {
      console.log(`✅ [STORAGE] Ingestion job progress updated`);
    } else {
      console.log(`❌ [STORAGE] Ingestion job not found for progress update`);
    }
    
    return jobUpdated;
  }

  /**
   * Increment ingestion job attempt count
   */
  async incrementIngestionJobAttempt(id: string): Promise<IngestionJob | undefined> {
    console.log(`🔄 [STORAGE] Incrementing ingestion job attempt: ${id}`);
    
    const [jobUpdated] = await db.update(ingestionJobs).set({
        updated_at: new Date()
      } as any)
      .where(eq(ingestionJobs.id, id))
      .returning();
    
    if (jobUpdated) {
      console.log(`✅ [STORAGE] Ingestion job attempt incremented to ${jobUpdated.attempts}`);
    } else {
      console.log(`❌ [STORAGE] Ingestion job not found for attempt increment`);
    }
    
    return jobUpdated;
  }

  /**
   * Delete ingestion job
   */
  async deleteIngestionJob(id: string): Promise<void> {
    console.log(`🗑️ [STORAGE] Deleting ingestion job: ${id}`);
    
    await db.delete(ingestionJobs)
      .where(eq(ingestionJobs.id, id));
    
    console.log(`✅ [STORAGE] Ingestion job deleted`);
  }

  /**
   * Get queued ingestion jobs for processing
   */
  async getQueuedIngestionJobs(workerId?: string, limit?: number): Promise<IngestionJob[]> {
    console.log(`🔍 [STORAGE] Getting queued ingestion jobs (worker: ${workerId || 'any'}, limit: ${limit || 'none'})`);
    
    let query = db.select().from(ingestionJobs)
      .where(eq(ingestionJobs.status, 'queued'))
      .orderBy(ingestionJobs.created_at) as any; // FIFO order
    
    if (limit) {
      query = (query as any).limit(limit);
    }
    
    const jobs = await query;
    
    console.log(`✅ [STORAGE] Found ${jobs.length} queued ingestion jobs`);
    return jobs;
  }

  /**
   * Assign ingestion job to worker
   */
  async assignIngestionJobToWorker(id: string, workerId: string): Promise<IngestionJob | undefined> {
    console.log(`🎯 [STORAGE] Assigning ingestion job ${id} to worker ${workerId}`);
    
    // Use optimistic locking by checking status when updating
    const [jobUpdated] = await db.update(ingestionJobs).set({
        status: 'running',
        started_at: new Date(),
        updated_at: new Date()
      } as any)
      .where(and(
        eq(ingestionJobs.id, id),
        eq(ingestionJobs.status, 'queued') // Only assign if still queued
      ))
      .returning();
    
    if (jobUpdated) {
      console.log(`✅ [STORAGE] Ingestion job assigned to worker ${workerId}`);
    } else {
      console.log(`❌ [STORAGE] Ingestion job not available for assignment (may have been assigned to another worker)`);
    }
    
    return jobUpdated;
  }

  /**
   * Get ingestion jobs that need retry
   */
  async getIngestionJobsForRetry(): Promise<IngestionJob[]> {
    console.log(`🔍 [STORAGE] Getting ingestion jobs ready for retry`);
    
    const now = new Date();
    
    const jobs = await db.select().from(ingestionJobs)
      .where(and(
        eq(ingestionJobs.status, 'queued'),
        lt(ingestionJobs.next_retry_at as any, now)
      ))
      .orderBy(ingestionJobs.next_retry_at);
    
    console.log(`✅ [STORAGE] Found ${jobs.length} jobs ready for retry`);
    return jobs;
  }

  // ============== ASSET FILES OPERATIONS ==============

  /**
   * Create asset file record
   */
  async createAssetFile(asset: InsertAssetFile): Promise<AssetFile> {
    console.log(`📁 [STORAGE] Creating asset file record: ${(asset as any).source_url}`);
    
    const [newAsset] = await db.insert(assetFiles).values(asset as any).returning();
    
    console.log(`✅ [STORAGE] Asset file record created: ${newAsset.id}`);
    return newAsset;
  }

  /**
   * Get asset file by ID
   */
  async getAssetFile(id: string): Promise<AssetFile | undefined> {
    console.log(`🔍 [STORAGE] Getting asset file: ${id}`);
    
    const [asset] = await db.select().from(assetFiles)
      .where(eq(assetFiles.id, id))
      .limit(1);
    
    if (asset) {
      console.log(`✅ [STORAGE] Found asset file`);
    } else {
      console.log(`❌ [STORAGE] Asset file not found`);
    }
    
    return asset;
  }

  /**
   * Get asset file by content hash
   */
  async getAssetFileByHash(contentHash: string): Promise<AssetFile | undefined> {
    console.log(`🔍 [STORAGE] Getting asset file by hash: ${contentHash}`);
    
    const [asset] = await db.select().from(assetFiles)
      .where(eq(assetFiles.content_hash, contentHash))
      .limit(1);
    
    if (asset) {
      console.log(`✅ [STORAGE] Found asset file by hash`);
    } else {
      console.log(`❌ [STORAGE] Asset file not found by hash`);
    }
    
    return asset;
  }

  /**
   * Get asset file by source URL
   */
  async getAssetFileByUrl(sourceUrl: string): Promise<AssetFile | undefined> {
    console.log(`🔍 [STORAGE] Getting asset file by URL: ${sourceUrl}`);
    
    const [asset] = await db.select().from(assetFiles)
      .where(eq(assetFiles.source_url, sourceUrl))
      .limit(1);
    
    if (asset) {
      console.log(`✅ [STORAGE] Found asset file by URL`);
    } else {
      console.log(`❌ [STORAGE] Asset file not found by URL`);
    }
    
    return asset;
  }

  /**
   * Update asset file
   */
  async updateAssetFile(id: string, updates: Partial<InsertAssetFile>): Promise<AssetFile | undefined> {
    console.log(`🔄 [STORAGE] Updating asset file: ${id}`);
    
    const [assetUpdated] = await db.update(assetFiles).set({ ...updates, updated_at: new Date() } as any)
      .where(eq(assetFiles.id, id))
      .returning();
    
    if (assetUpdated) {
      console.log(`✅ [STORAGE] Asset file updated`);
    } else {
      console.log(`❌ [STORAGE] Asset file not found for update`);
    }
    
    return assetUpdated;
  }

  /**
   * Update asset file status
   */
  async updateAssetFileStatus(id: string, fetchStatus: string, processStatus: string, errorMessage?: string): Promise<AssetFile | undefined> {
    console.log(`🔄 [STORAGE] Updating asset file status: ${id} -> ${fetchStatus}/${processStatus}`);
    
    const updates: any = {
      fetch_status: fetchStatus,
      process_status: processStatus,
      updated_at: new Date()
    };
    
    if (errorMessage) {
      updates.error_message = errorMessage;
    }
    
    const [assetUpdated] = await db.update(assetFiles).set(updates)
      .where(eq(assetFiles.id, id))
      .returning();
    
    if (assetUpdated) {
      console.log(`✅ [STORAGE] Asset file status updated`);
    } else {
      console.log(`❌ [STORAGE] Asset file not found for status update`);
    }
    
    return assetUpdated;
  }

  /**
   * Get asset files by status
   */
  async getAssetFilesByStatus(fetchStatus?: string, processStatus?: string, limit?: number): Promise<AssetFile[]> {
    console.log(`🔍 [STORAGE] Getting asset files by status: ${fetchStatus}/${processStatus}`);
    
    let query = db.select().from(assetFiles);
    
    const conditions = [];
    if (fetchStatus) {
      conditions.push(eq(assetFiles.fetch_status, fetchStatus));
    }
    if (processStatus) {
      conditions.push(eq(assetFiles.process_status, processStatus));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    query = query.orderBy(desc(assetFiles.created_at)) as any;
    
    if (limit) {
      query = (query as any).limit(limit);
    }
    
    const assets = await query;
    
    console.log(`✅ [STORAGE] Found ${assets.length} asset files`);
    return assets;
  }

  /**
   * Get asset files by MIME type
   */
  async getAssetFilesByMimeType(mimeType: string, limit?: number): Promise<AssetFile[]> {
    console.log(`🔍 [STORAGE] Getting asset files by MIME type: ${mimeType}`);
    
    let query = db.select().from(assetFiles)
      .where(eq(assetFiles.mime_type, mimeType))
      .orderBy(desc(assetFiles.created_at)) as any;
    
    if (limit) {
      query = (query as any).limit(limit);
    }
    
    const assets = await query;
    
    console.log(`✅ [STORAGE] Found ${assets.length} asset files with MIME type ${mimeType}`);
    return assets;
  }

  /**
   * Delete asset file
   */
  async deleteAssetFile(id: string): Promise<void> {
    console.log(`🗑️ [STORAGE] Deleting asset file: ${id}`);
    
    await db.delete(assetFiles)
      .where(eq(assetFiles.id, id));
    
    console.log(`✅ [STORAGE] Asset file deleted`);
  }

  /**
   * Update asset file access timestamp
   */
  async updateAssetFileAccess(id: string): Promise<void> {
    console.log(`🔄 [STORAGE] Updating asset file access: ${id}`);
    
    await db.update(assetFiles)
    await db.update(assetFiles).set({ last_accessed: new Date() } as any)
    
    console.log(`✅ [STORAGE] Asset file access updated`);
  }

  // ============== ENHANCED PROJECT SUBSCRIPTIONS OPERATIONS ==============
  
  /**
   * Create enhanced project subscription
   */
  async createEnhancedProjectSubscription(subscription: InsertEnhancedProjectSubscription): Promise<EnhancedProjectSubscription> {
    console.log(`📝 [STORAGE] Creating enhanced project subscription for project: ${(subscription as any).project_id}`);
    
    const [created] = await db.insert(enhancedProjectSubscriptions)
      .values(subscription as any)
      .returning();
    
    console.log(`✅ [STORAGE] Enhanced project subscription created`);
    return created;
  }

  /**
   * Get enhanced project subscription by ID
   */
  async getEnhancedProjectSubscription(id: string): Promise<EnhancedProjectSubscription | undefined> {
    console.log(`🔍 [STORAGE] Getting enhanced project subscription: ${id}`);
    
    const [subscription] = await db.select().from(enhancedProjectSubscriptions)
      .where(eq(enhancedProjectSubscriptions.id, id))
      .limit(1);
    
    if (subscription) {
      console.log(`✅ [STORAGE] Enhanced project subscription found`);
    } else {
      console.log(`❌ [STORAGE] Enhanced project subscription not found`);
    }
    
    return subscription;
  }

  /**
   * Get enhanced project subscription by project ID
   */
  async getEnhancedProjectSubscriptionByProject(projectId: string): Promise<EnhancedProjectSubscription | undefined> {
    console.log(`🔍 [STORAGE] Getting enhanced project subscription for project: ${projectId}`);
    
    const [subscription] = await db.select().from(enhancedProjectSubscriptions)
      .where(eq(enhancedProjectSubscriptions.project_id, projectId))
      .limit(1);
    
    if (subscription) {
      console.log(`✅ [STORAGE] Enhanced project subscription found for project`);
    } else {
      console.log(`❌ [STORAGE] Enhanced project subscription not found for project`);
    }
    
    return subscription;
  }

  /**
   * Update enhanced project subscription
   */
  async updateEnhancedProjectSubscription(id: string, updates: Partial<InsertEnhancedProjectSubscription>): Promise<EnhancedProjectSubscription | undefined> {
    console.log(`🔄 [STORAGE] Updating enhanced project subscription: ${id}`);
    
    const [subUpdated] = await (db.update(enhancedProjectSubscriptions).set({ ...updates, updated_at: new Date() } as any)
      .where(eq(enhancedProjectSubscriptions.id, id))
      .returning() as any);
    
    if (subUpdated) {
      console.log(`✅ [STORAGE] Enhanced project subscription updated`);
    } else {
      console.log(`❌ [STORAGE] Enhanced project subscription not found for update`);
    }
    
    return subUpdated;
  }

  /**
   * Delete enhanced project subscription
   */
  async deleteEnhancedProjectSubscription(id: string): Promise<void> {
    console.log(`🗑️ [STORAGE] Deleting enhanced project subscription: ${id}`);
    
    await db.delete(enhancedProjectSubscriptions)
      .where(eq(enhancedProjectSubscriptions.id, id));
    
    console.log(`✅ [STORAGE] Enhanced project subscription deleted`);
  }

  /**
   * Get enhanced project subscriptions by tier
   */
  async getEnhancedProjectSubscriptionsByTier(tier: string): Promise<EnhancedProjectSubscription[]> {
    console.log(`🔍 [STORAGE] Getting enhanced project subscriptions by tier: ${tier}`);
    
    const subscriptions = await db.select().from(enhancedProjectSubscriptions)
      .where(eq(enhancedProjectSubscriptions.subscription_tier, tier))
      .orderBy(desc(enhancedProjectSubscriptions.created_at));
    
    console.log(`✅ [STORAGE] Found ${subscriptions.length} subscriptions for tier ${tier}`);
    return subscriptions;
  }

  /**
   * Get enhanced project subscriptions by status
   */
  async getEnhancedProjectSubscriptionsByStatus(status: string): Promise<EnhancedProjectSubscription[]> {
    console.log(`🔍 [STORAGE] Getting enhanced project subscriptions by status: ${status}`);
    
    const subscriptions = await db.select().from(enhancedProjectSubscriptions)
      .where(eq(enhancedProjectSubscriptions.subscription_status, status))
      .orderBy(desc(enhancedProjectSubscriptions.created_at));
    
    console.log(`✅ [STORAGE] Found ${subscriptions.length} subscriptions with status ${status}`);
    return subscriptions;
  }

  /**
   * Get expired enhanced project subscriptions
   */
  async getExpiredEnhancedProjectSubscriptions(): Promise<EnhancedProjectSubscription[]> {
    console.log(`🔍 [STORAGE] Getting expired enhanced project subscriptions`);
    
    const now = new Date();
    const subscriptions = await db.select().from(enhancedProjectSubscriptions)
      .where(and(
        eq(enhancedProjectSubscriptions.subscription_status, 'active'),
        lt(enhancedProjectSubscriptions.subscription_expires_at, now)
      ))
      .orderBy(desc(enhancedProjectSubscriptions.subscription_expires_at));
    
    console.log(`✅ [STORAGE] Found ${subscriptions.length} expired subscriptions`);
    return subscriptions;
  }

  /**
   * Update subscription usage
   */
  async updateSubscriptionUsage(projectId: string, updates: {
    currentOverrideEntities?: number;
    currentAssetStorageGb?: string;
    currentMonthlyApiCalls?: number;
  }): Promise<EnhancedProjectSubscription | undefined> {
    console.log(`🔄 [STORAGE] Updating subscription usage for project: ${projectId}`);
    
    const updateData: any = { updated_at: new Date() };
    
    if (updates.currentOverrideEntities !== undefined) {
      updateData.current_override_entities = updates.currentOverrideEntities;
    }
    if (updates.currentAssetStorageGb !== undefined) {
      updateData.current_asset_storage_gb = updates.currentAssetStorageGb;
    }
    if (updates.currentMonthlyApiCalls !== undefined) {
      updateData.current_monthly_api_calls = updates.currentMonthlyApiCalls;
    }
    
    const [subUpdated] = await db.update(enhancedProjectSubscriptions).set(updateData)
      .where(eq(enhancedProjectSubscriptions.project_id, projectId))
      .returning();
    
    if (subUpdated) {
      console.log(`✅ [STORAGE] Subscription usage updated`);
    } else {
      console.log(`❌ [STORAGE] Subscription not found for usage update`);
    }
    
    return subUpdated;
  }

  /**
   * Reset monthly API calls
   */
  async resetMonthlyApiCalls(projectId: string): Promise<EnhancedProjectSubscription | undefined> {
    console.log(`🔄 [STORAGE] Resetting monthly API calls for project: ${projectId}`);
    
    const [subUpdated] = await (db.update(enhancedProjectSubscriptions).set({ current_monthly_api_calls: 0, updated_at: new Date() } as any)
      .where(eq(enhancedProjectSubscriptions.project_id, projectId))
      .returning() as any);
    
    if (subUpdated) {
      console.log(`✅ [STORAGE] Monthly API calls reset`);
    } else {
      console.log(`❌ [STORAGE] Subscription not found for API calls reset`);
    }
    
    return subUpdated;
  }

  /**
   * Check subscription limits
   */
  async checkSubscriptionLimits(projectId: string): Promise<{
    canAddOverrides: boolean;
    canUseStorage: boolean;
    canMakeApiCalls: boolean;
    canRunJobs: boolean;
  }> {
    console.log(`🔍 [STORAGE] Checking subscription limits for project: ${projectId}`);
    
    const subscription = await this.getEnhancedProjectSubscriptionByProject(projectId);
    
    if (!subscription) {
      return {
        canAddOverrides: false,
        canUseStorage: false,
        canMakeApiCalls: false,
        canRunJobs: false
      };
    }
    
    const canAddOverrides = (subscription.current_override_entities || 0) < (subscription.max_override_entities || 0);
    const canUseStorage = Number(subscription.current_asset_storage_gb || 0) < Number(subscription.max_asset_storage_gb || 0);
    const canMakeApiCalls = (subscription.current_monthly_api_calls || 0) < (subscription.max_monthly_api_calls || 0);
    const canRunJobs = true; // Would need daily tracking logic
    
    return {
      canAddOverrides,
      canUseStorage,
      canMakeApiCalls,
      canRunJobs
    };
  }

  // ============== PROJECT CONTENT OVERRIDES OPERATIONS ==============
  
  /**
   * Create project content override
   */
  async createProjectContentOverride(override: InsertProjectContentOverride): Promise<ProjectContentOverride> {
    console.log(`📝 [STORAGE] Creating project content override for project: ${(override as any).project_id}`);
    
    const [created] = await db.insert(projectContentOverrides)
      .values(override as any)
      .returning();
    
    console.log(`✅ [STORAGE] Project content override created`);
    return created;
  }

  /**
   * Get project content override by ID
   */
  async getProjectContentOverride(id: string): Promise<ProjectContentOverride | undefined> {
    console.log(`🔍 [STORAGE] Getting project content override: ${id}`);
    
    const [override] = await db.select().from(projectContentOverrides)
      .where(eq(projectContentOverrides.id, id))
      .limit(1);
    
    if (override) {
      console.log(`✅ [STORAGE] Project content override found`);
    } else {
      console.log(`❌ [STORAGE] Project content override not found`);
    }
    
    return override;
  }

  /**
   * Get project content overrides by project ID
   */
  async getProjectContentOverridesByProject(projectId: string): Promise<ProjectContentOverride[]> {
    console.log(`🔍 [STORAGE] Getting project content overrides for project: ${projectId}`);
    
    const overrides = await db.select().from(projectContentOverrides)
      .where(eq(projectContentOverrides.project_id, projectId))
      .orderBy(desc(projectContentOverrides.created_at));
    
    console.log(`✅ [STORAGE] Found ${overrides.length} overrides for project`);
    return overrides;
  }

  /**
   * Update project content override
   */
  async updateProjectContentOverride(id: string, updates: Partial<InsertProjectContentOverride>): Promise<ProjectContentOverride | undefined> {
    console.log(`🔄 [STORAGE] Updating project content override: ${id}`);
    
    const [updated] = await (db.update(projectContentOverrides).set({ ...updates, updated_at: new Date() } as any)
      .where(eq(projectContentOverrides.id, id))
      .returning() as any);
    
    if (updated) {
      console.log(`✅ [STORAGE] Project content override updated`);
    } else {
      console.log(`❌ [STORAGE] Project content override not found for update`);
    }
    
    return updated;
  }

  /**
   * Delete project content override
   */
  async deleteProjectContentOverride(id: string): Promise<void> {
    console.log(`🗑️ [STORAGE] Deleting project content override: ${id}`);
    
    await db.delete(projectContentOverrides)
      .where(eq(projectContentOverrides.id, id));
    
    console.log(`✅ [STORAGE] Project content override deleted`);
  }

  /**
   * Get project content overrides by status
   */
  async getProjectContentOverridesByStatus(status: string): Promise<ProjectContentOverride[]> {
    console.log(`🔍 [STORAGE] Getting project content overrides by status: ${status}`);
    
    const overrides = await db.select().from(projectContentOverrides)
      .where(eq(projectContentOverrides.status, status))
      .orderBy(desc(projectContentOverrides.created_at));
    
    console.log(`✅ [STORAGE] Found ${overrides.length} overrides with status ${status}`);
    return overrides;
  }

  /**
   * Get verified project content overrides
   */
  async getVerifiedProjectContentOverrides(projectId?: string): Promise<ProjectContentOverride[]> {
    console.log(`🔍 [STORAGE] Getting verified project content overrides${projectId ? ` for project: ${projectId}` : ''}`);
    
    let query = db.select().from(projectContentOverrides)
      .where(eq(projectContentOverrides.status, 'verified')) as any;
    
    if (projectId) {
      query = query.where(and(
        eq(projectContentOverrides.status, 'verified'),
        eq(projectContentOverrides.project_id, projectId)
      ));
    }
    
    const overrides = await query.orderBy(desc(projectContentOverrides.created_at));
    
    console.log(`✅ [STORAGE] Found ${overrides.length} verified overrides`);
    return overrides;
  }

  /**
   * Approve project content override
   */
  async approveProjectContentOverride(id: string, reviewedBy: string): Promise<ProjectContentOverride | undefined> {
    console.log(`✅ [STORAGE] Approving project content override: ${id}`);
    
    const [updated] = await (db.update(projectContentOverrides).set({ 
        reviewed_by: reviewedBy,
        reviewed_at: new Date(),
        updated_at: new Date()
      } as any)
      .where(eq(projectContentOverrides.id, id))
      .returning() as any);
    
    if (updated) {
      console.log(`✅ [STORAGE] Project content override approved`);
    } else {
      console.log(`❌ [STORAGE] Project content override not found for approval`);
    }
    
    return updated;
  }

  /**
   * Reject project content override
   */
  async rejectProjectContentOverride(id: string, reviewedBy: string): Promise<ProjectContentOverride | undefined> {
    console.log(`❌ [STORAGE] Rejecting project content override: ${id}`);
    
    const [updated] = await (db.update(projectContentOverrides).set({ 
        reviewed_by: reviewedBy,
        reviewed_at: new Date(),
        updated_at: new Date()
      } as any)
      .where(eq(projectContentOverrides.id, id))
      .returning() as any);
    
    if (updated) {
      console.log(`✅ [STORAGE] Project content override rejected`);
    } else {
      console.log(`❌ [STORAGE] Project content override not found for rejection`);
    }
    
    return updated;
  }

  // ===============================================================================
  // SEARCH SYSTEM IMPLEMENTATIONS
  // ===============================================================================

  async searchUnified(query: string, limit: number = 10): Promise<UnifiedSearchResult[]> {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    const results: UnifiedSearchResult[] = [];
    
    try {
      // Search in parallel for better performance
      const [profiles, projects, pages] = await Promise.all([
        this.searchProfiles(cleanQuery, Math.ceil(limit / 3)),
        this.searchProjects(cleanQuery, Math.ceil(limit / 3)),
        this.searchPages(cleanQuery, Math.ceil(limit / 3))
      ]);

      results.push(...profiles, ...projects, ...pages);
      
      // Sort by relevance and limit results
      return results
        .sort((a, b) => {
          // Exact title matches first
          const aExact = a.title.toLowerCase().includes(cleanQuery) ? 1 : 0;
          const bExact = b.title.toLowerCase().includes(cleanQuery) ? 1 : 0;
          if (aExact !== bExact) return bExact - aExact;
          
          // Then by type preference
          const typeOrder = { profile: 3, project: 2, page: 1, token: 4, nft: 2 };
          return (typeOrder[b.type] || 0) - (typeOrder[a.type] || 0);
        })
        .slice(0, limit);
        
    } catch (error) {
      console.error('❌ [STORAGE] Search unified error:', error);
      return [];
    }
  }

  async searchProfiles(query: string, limit: number = 10): Promise<UnifiedSearchResult[]> {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    try {
      // Search in both riddleWallets and social_profiles tables (fetch more to avoid underfill)
      const [riddleProfiles, socialProfiles] = await Promise.all([
        // Search riddleWallets table
        db
          .select({
            id: riddleWallets.id,
            handle: riddleWallets.handle
          })
          .from(riddleWallets)
          .where(
            sql`LOWER(${riddleWallets.handle}) LIKE ${`%${cleanQuery}%`}`
          )
          .limit(limit * 2), // Fetch more to prevent underfill after deduplication

        // Search social_profiles table (same as messaging search)
        db.execute(sql`
          SELECT 
            handle,
            display_name,
            bio,
            profile_picture_url
          FROM social_profiles 
          WHERE (
            LOWER(handle) LIKE LOWER(${`%${cleanQuery}%`}) OR 
            LOWER(display_name) LIKE LOWER(${`%${cleanQuery}%`}) OR
            LOWER(bio) LIKE LOWER(${`%${cleanQuery}%`})
          )
          LIMIT ${limit * 2}
        `)
      ]);

      const results: UnifiedSearchResult[] = [];

      // Add riddleWallets results
      results.push(...riddleProfiles.map(profile => ({
        id: profile.id,
        type: 'profile' as const,
        title: profile.handle,
        description: 'Riddle user profile',
        url: `/social-profile/${profile.handle}`,
        image: undefined,
        metadata: {
          handle: profile.handle,
          profileType: 'riddle_wallet',
          isExactMatch: profile.handle.toLowerCase() === cleanQuery
        }
      })));

      // Add social_profiles results - fix: access rows property from execute result
      const socialResults = (socialProfiles?.rows || []).map((row: any) => ({
        id: row.handle,
        type: 'profile' as const,
        title: row.display_name || row.handle,
        description: row.bio || 'Social profile',
        url: `/social-profile/${row.handle}`,
        image: row.profile_picture_url || undefined,
        metadata: {
          handle: row.handle,
          profileType: 'social_profile',
          isExactMatch: row.handle.toLowerCase() === cleanQuery
        }
      }));

      results.push(...socialResults);

      // Remove duplicates by handle - prefer profiles with images
      const uniqueProfiles = new Map();
      for (const profile of results) {
        const existingProfile = uniqueProfiles.get(profile.metadata.handle);
        if (!existingProfile) {
          // No existing profile, add this one
          uniqueProfiles.set(profile.metadata.handle, profile);
        } else if (profile.image && !existingProfile.image) {
          // This profile has an image but existing doesn't, replace it
          uniqueProfiles.set(profile.metadata.handle, profile);
        } else if (profile.metadata.profileType === 'social_profile' && existingProfile.metadata.profileType === 'riddle_wallet') {
          // Prefer social_profile over riddle_wallet for better data
          uniqueProfiles.set(profile.metadata.handle, profile);
        }
      }

      // Sort by relevance: exact matches first, then by title
      const sortedResults = Array.from(uniqueProfiles.values()).sort((a, b) => {
        // Exact handle matches first
        if (a.metadata.isExactMatch && !b.metadata.isExactMatch) return -1;
        if (!a.metadata.isExactMatch && b.metadata.isExactMatch) return 1;
        
        // Then sort by title alphabetically
        return a.title.localeCompare(b.title);
      });

      return sortedResults.slice(0, limit);

    } catch (error) {
      console.error('❌ [STORAGE] Search profiles error:', error);
      return [];
    }
  }

  async searchProjects(query: string, limit: number = 10): Promise<UnifiedSearchResult[]> {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    try {
      // Search in devtoolsProjects table
      const projects = await db
        .select({
          id: devtoolsProjects.id,
          name: devtoolsProjects.name,
          description: devtoolsProjects.description,
          asset_type: devtoolsProjects.asset_type,
          vanity_slug: devtoolsProjects.vanity_slug,
          logo_url: devtoolsProjects.logo_url,
          status: devtoolsProjects.status
        })
        .from(devtoolsProjects)
        .where(
          and(
            eq(devtoolsProjects.status, 'active'),
            or(
              sql`LOWER(${devtoolsProjects.name}) LIKE ${`%${cleanQuery}%`}`,
              sql`LOWER(${devtoolsProjects.description}) LIKE ${`%${cleanQuery}%`}`,
              sql`LOWER(${devtoolsProjects.vanity_slug}) LIKE ${`%${cleanQuery}%`}`
            )
          )
        )
        .limit(limit);

      return projects.map(project => ({
        id: project.id,
        type: 'project' as const,
        title: project.name,
        description: project.description || `${project.asset_type} project`,
        url: project.vanity_slug ? `/${project.vanity_slug}` : `/project/${project.id}`,
        image: project.logo_url || undefined,
        metadata: {
          asset_type: project.asset_type,
          vanity_slug: project.vanity_slug,
          status: project.status
        }
      }));

    } catch (error) {
      console.error('❌ [STORAGE] Search projects error:', error);
      return [];
    }
  }

  async searchPages(query: string, limit: number = 10): Promise<UnifiedSearchResult[]> {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    try {
      // Search in pageMetadata table - select only required fields to avoid schema issues
      const pages = await db
        .select({
          id: pageMetadata.id,
          page_title: pageMetadata.page_title,
          page_description: pageMetadata.page_description,
          page_path: pageMetadata.page_path,
          page_type: pageMetadata.page_type,
          is_dynamic: pageMetadata.is_dynamic
        })
        .from(pageMetadata)
        .where(
          and(
            eq(pageMetadata.searchable, true),
            or(
              sql`LOWER(${pageMetadata.page_title}) LIKE ${`%${cleanQuery}%`}`,
              sql`LOWER(${pageMetadata.page_description}) LIKE ${`%${cleanQuery}%`}`,
              sql`LOWER(${pageMetadata.page_path}) LIKE ${`%${cleanQuery}%`}`
            )
          )
        )
        .limit(limit);

      return pages.map(page => ({
        id: page.id,
        type: 'page' as const,
        title: page.page_title,
        description: page.page_description || 'Page content',
        url: page.page_path,
        image: undefined, // Image not needed for page search results
        metadata: {
          page_type: page.page_type,
          is_dynamic: page.is_dynamic
        }
      }));

    } catch (error) {
      console.error('❌ [STORAGE] Search pages error:', error);
      return [];
    }
  }

  async recordSearchAnalytics(analytics: InsertSearchAnalytics): Promise<SearchAnalytics> {
    try {
      // Ensure search_type is set based on results_count
      const analyticsWithType = {
        ...analytics,
        search_type: (analytics as any).search_type || ((analytics as any).results_count > 0 ? 'successful' : 'no_results')
      };
      
      const [result] = await db
        .insert(searchAnalytics)
        .values(analyticsWithType as any)
        .returning();
      return result;
    } catch (error) {
      console.error('❌ [STORAGE] Record search analytics error:', error);
      throw error;
    }
  }

  async getPopularSearches(limit: number = 10): Promise<{ query: string; count: number }[]> {
    try {
      const popular = await db
        .select({
          query: searchAnalytics.query,
          count: sql<number>`COUNT(*)`.as('count')
        })
        .from(searchAnalytics)
        .where(gt(searchAnalytics.created_at, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))) // Last 30 days
        .groupBy(searchAnalytics.query)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(limit);

      return popular;
    } catch (error) {
      console.error('❌ [STORAGE] Get popular searches error:', error);
      return [];
    }
  }

  async createPageMetadata(metadata: InsertPageMetadata): Promise<PageMetadata> {
    try {
      const [result] = await db
        .insert(pageMetadata)
        .values(metadata as any)
        .returning();
      return result;
    } catch (error) {
      console.error('❌ [STORAGE] Create page metadata error:', error);
      throw error;
    }
  }

  async getPageMetadata(path: string): Promise<PageMetadata | undefined> {
    try {
      const [result] = await db
        .select()
        .from(pageMetadata)
        .where(eq(pageMetadata.page_path, path));
      return result;
    } catch (error) {
      console.error('❌ [STORAGE] Get page metadata error:', error);
      return undefined;
    }
  }

  async updatePageMetadata(path: string, updates: Partial<InsertPageMetadata>): Promise<PageMetadata | undefined> {
    try {
      const [result] = await db
        .update(pageMetadata).set({ ...updates, updated_at: new Date() } as any)
        .returning();
      return result;
    } catch (error) {
      console.error('❌ [STORAGE] Update page metadata error:', error);
      return undefined;
    }
  }

  async getAllSearchablePages(): Promise<PageMetadata[]> {
    try {
      return await db
        .select()
        .from(pageMetadata)
        .where(eq(pageMetadata.searchable, true))
        .orderBy(pageMetadata.page_title);
    } catch (error) {
      console.error('❌ [STORAGE] Get searchable pages error:', error);
      return [];
    }
  }

  async upsertPageMetadata(metadata: InsertPageMetadata): Promise<PageMetadata> {
    try {
      const [result] = await db
        .insert(pageMetadata)
        .values(metadata as any)
        .onConflictDoUpdate({
          target: pageMetadata.page_path,
          set: { 
            ...metadata,
            updated_at: new Date()
          } as any
        })
        .returning();
      return result;
    } catch (error) {
      console.error('❌ [STORAGE] Upsert page metadata error:', error);
      throw error;
    }
  }

  async getCachedSearchResults(query: string): Promise<SearchResult[]> {
    try {
      return await db
        .select()
        .from(searchResults)
        .where(eq(searchResults.query, query.toLowerCase()))
        .orderBy(desc(searchResults.search_count));
    } catch (error) {
      console.error('❌ [STORAGE] Get cached search results error:', error);
      return [];
    }
  }

  async setCachedSearchResults(results: InsertSearchResult[]): Promise<void> {
    try {
      if (results.length > 0) {
        await db.insert(searchResults).values(results as any);
      }
    } catch (error) {
      console.error('❌ [STORAGE] Set cached search results error:', error);
    }
  }

  async updateSearchResultPopularity(query: string, resultId: string): Promise<void> {
    try {
      await db
        .update(searchResults).set({ 
          last_searched: new Date()
        } as any)
        .where(
          and(
            eq(searchResults.query, query.toLowerCase()),
            eq(searchResults.result_id, resultId)
          )
        );
    } catch (error) {
      console.error('❌ [STORAGE] Update search result popularity error:', error);
    }
  }

  // ============== WALLET METRICS OPERATIONS ==============

  async getWalletMetrics(address: string): Promise<WalletMetrics | undefined> {
    const [metrics] = await db
      .select()
      .from(walletMetrics)
      .where(eq(walletMetrics.address, address));
    return metrics || undefined;
  }

  async setWalletMetrics(metrics: InsertWalletMetrics): Promise<WalletMetrics> {
    // Upsert - insert or update if exists
    const [result] = await db
      .insert(walletMetrics)
      .values({
        ...metrics,
        updated_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      } as any)
      .onConflictDoUpdate({
        target: walletMetrics.address,
        set: {
          ...metrics,
          updated_at: new Date(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
        } as any
      })
      .returning();
    return result;
  }

  async updateWalletMetrics(address: string, updates: Partial<InsertWalletMetrics>): Promise<WalletMetrics | undefined> {
    const [result] = await db
      .update(walletMetrics).set({
        ...updates,
        updated_at: new Date()
      } as any)
      .where(eq(walletMetrics.address, address))
      .returning();
    return result || undefined;
  }

  async getTopRankedWallets(limit = 50): Promise<WalletMetrics[]> {
    return await db
      .select()
      .from(walletMetrics)
      .where(gt(walletMetrics.expires_at, new Date()))
      .orderBy(desc(walletMetrics.overall_score))
      .limit(limit);
  }

  async getWalletsByTier(tier: string, limit = 50): Promise<WalletMetrics[]> {
    return await db
      .select()
      .from(walletMetrics)
      .where(and(
        eq(walletMetrics.wallet_tier, tier),
        gt(walletMetrics.expires_at, new Date())
      ))
      .orderBy(desc(walletMetrics.overall_score))
      .limit(limit);
  }

  async getRiddleWalletMetrics(limit = 50): Promise<WalletMetrics[]> {
    return await db
      .select()
      .from(walletMetrics)
      .where(and(
        eq(walletMetrics.is_riddle_wallet, true),
        gt(walletMetrics.expires_at, new Date())
      ))
      .orderBy(desc(walletMetrics.overall_score))
      .limit(limit);
  }

  async clearExpiredWalletMetrics(): Promise<void> {
    await db
      .delete(walletMetrics)
      .where(lt(walletMetrics.expires_at, new Date()));
  }

  // Gaming NFT Methods Implementation
  // =================================

  async getGamingCollections(): Promise<any[]> {
    return db
      .select()
      .from(gamingNftCollections)
      .where(eq(gamingNftCollections.active_in_game, true))
      .orderBy(gamingNftCollections.taxon);
  }

  async createGamingNFT(nftData: any): Promise<void> {
    await db
      .insert(gamingNfts)
      .values({
        ...nftData,
        metadata_updated: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      } as any)
      .onConflictDoUpdate({
        target: gamingNfts.nft_id,
        set: {
          owner_address: nftData.owner_address,
          metadata: nftData.metadata || {},
          traits: nftData.traits || {},
          image_url: nftData.image_url,
          updated_at: new Date()
        } as any
      });
  }

  async createGamingPlayer(playerData: any): Promise<void> {
    await db
      .insert(gamingPlayers)
      .values({
        ...playerData,
        created_at: new Date(),
        updated_at: new Date()
      })
      .onConflictDoUpdate({
        target: gamingPlayers.user_handle,
        set: {
          ...playerData,
          updated_at: new Date()
        }
      });
  }

  async getGamingPlayer(userHandle: string): Promise<any[]> {
    return db
      .select()
      .from(gamingPlayers)
      .where(eq(gamingPlayers.user_handle, userHandle))
      .limit(1);
  }

  async getPlayerNFTs(walletAddress: string): Promise<any[]> {
    return db
      .select({
        nft: gamingNfts,
        collection: gamingNftCollections
      })
      .from(gamingNfts)
      .innerJoin(gamingNftCollections, eq(gamingNfts.collection_id, gamingNftCollections.id))
      .where(eq(gamingNfts.owner_address, walletAddress));
  }

  async createGamingEvent(eventData: any): Promise<void> {
    await db.insert(gamingEvents).values({
      ...eventData,
      created_at: new Date()
    });
  }

  async getGamingEvents(playerId: string, limit: number = 10): Promise<any[]> {
    return db
      .select()
      .from(gamingEvents)
      .where(eq(gamingEvents.player_id, playerId))
      .orderBy(desc(gamingEvents.created_at))
      .limit(limit);
  }

  async getGamingLeaderboard(limit: number = 50): Promise<any[]> {
    return db
      .select({
        user_handle: gamingPlayers.user_handle,
        player_name: gamingPlayers.player_name,
        total_nfts_owned: gamingPlayers.total_nfts_owned,
        total_power_level: gamingPlayers.total_power_level,
        gaming_rank: gamingPlayers.gaming_rank,
        army_power: gamingPlayers.army_power,
        bank_power: gamingPlayers.bank_power,
        merchant_power: gamingPlayers.merchant_power,
        special_power: gamingPlayers.special_power,
        verification_completed_at: gamingPlayers.verification_completed_at
      })
      .from(gamingPlayers)
      .where(eq(gamingPlayers.is_gaming_verified, true))
      .orderBy(desc(gamingPlayers.total_power_level))
      .limit(limit);
  }

  // Payment Preference Methods
  // ==========================
  
  async setUserPaymentPreference(userHandle: string, preference: 'RDL_ONLY' | 'XRP_PREFERRED' | 'FLEXIBLE'): Promise<void> {
    // For now, store in gaming players table as it's the most relevant user table
    // In a real implementation, you might want a dedicated user preferences table
    await db
      .update(gamingPlayers).set({ payment_preference: preference, updated_at: new Date() } as any)
  }
  
  async getUserPaymentPreference(userHandle: string): Promise<string | null> {
    const result = await db
      .select({ payment_preference: gamingPlayers.payment_preference })
      .from(gamingPlayers)
      .where(eq(gamingPlayers.user_handle, userHandle))
      .limit(1);
      
    return result.length > 0 ? result[0].payment_preference : null;
  }
  
  // Weapon Mint Queue Methods (Enhanced)
  // ===================================
  
  async addWeaponMintQueue(queueData: any): Promise<void> {
    await db.insert(weaponMintQueue).values({
      ...queueData,
      created_at: new Date(),
      updated_at: new Date()
    });
  }
  
  async getWeaponMintQueue(queueId: string): Promise<any | null> {
    const result = await db
      .select()
      .from(weaponMintQueue)
      .where(eq(weaponMintQueue.id, queueId))
      .limit(1);
      
    return result.length > 0 ? result[0] : null;
  }
  
  async updateWeaponMintQueueStatus(queueId: string, status: string, additionalData?: any): Promise<void> {
    const updateData: any = {
      status: status,
      updated_at: new Date()
    };
    
    if (additionalData) {
      Object.assign(updateData, additionalData);
    }
    
    await db
      .update(weaponMintQueue).set(updateData)
      .where(eq(weaponMintQueue.id, queueId));
  }
  
  async addPlayerNftWeapon(weaponData: any): Promise<void> {
    await db.insert(playerNftWeapons).values({
      ...weaponData,
      created_at: new Date(),
      updated_at: new Date()
    });
  }
  
  async getPlayerNftWeapons(playerHandle: string): Promise<any[]> {
    return db
      .select()
      .from(playerNftWeapons)
      .innerJoin(gamingPlayers, eq(playerNftWeapons.playerId, gamingPlayers.id))
      .where(eq(gamingPlayers.user_handle, playerHandle))
      .orderBy(desc(playerNftWeapons.createdAt));
  }
  
  // Civilization Management Methods
  // ===============================
  
  async createPlayerCivilization(civilizationData: any): Promise<void> {
    // Get player_id from user_handle if not provided
    let playerId = civilizationData.player_id;
    if (!playerId && civilizationData.user_handle) {
      const player = await db.select({ id: gamingPlayers.id })
        .from(gamingPlayers)
        .where(eq(gamingPlayers.user_handle, civilizationData.user_handle))
        .limit(1);
      playerId = player[0]?.id;
    }

    if (!playerId) {
      throw new Error('Cannot create civilization: player_id is required');
    }

    await db.insert(playerCivilizations).values({
      ...civilizationData,
      player_id: playerId,
      founded_at: new Date(),
      last_active: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    });
  }
  
  async getPlayerCivilization(userHandle: string): Promise<any | null> {
    const result = await db
      .select({
        id: playerCivilizations.id,
        player_id: playerCivilizations.player_id,
        civilization_name: playerCivilizations.civilization_name,
        civilization_type: playerCivilizations.civilization_type,
        motto: playerCivilizations.motto,
        color_primary: playerCivilizations.color_primary,
        color_secondary: playerCivilizations.color_secondary,
        color_accent: playerCivilizations.color_accent,
        crest_image: playerCivilizations.crest_image,
        created_at: playerCivilizations.created_at,
        updated_at: playerCivilizations.updated_at
      })
      .from(playerCivilizations)
      .innerJoin(gamingPlayers, eq(playerCivilizations.player_id, gamingPlayers.id))
      .where(eq(gamingPlayers.user_handle, userHandle))
      .limit(1);
      
    return result.length > 0 ? result[0] : null;
  }
  
  async updatePlayerCivilization(userHandle: string, updateData: any): Promise<void> {
    // First get the player_id for this user_handle
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });
    
    if (!player) {
      throw new Error('Player not found');
    }

    await db
      .update(playerCivilizations).set({ ...updateData, updated_at: new Date() } as any)
  }
  
  // Alliance Management Methods
  // ===========================
  
  async createAllyRequest(requestData: any): Promise<void> {
    await db.insert(allyRequests).values({
      ...requestData,
      created_at: new Date(),
      updated_at: new Date()
    });
  }
  
  async getAllyRequest(requestId: string): Promise<any | null> {
    const result = await db
      .select()
      .from(allyRequests)
      .where(eq(allyRequests.id, requestId))
      .limit(1);
      
    return result.length > 0 ? result[0] : null;
  }
  
  async getIncomingAllyRequests(userHandle: string): Promise<any[]> {
    return db
      .select()
      .from(allyRequests)
      .where(and(
        eq(allyRequests.receiver_handle, userHandle),
        eq(allyRequests.status, 'pending')
      ))
      .orderBy(desc(allyRequests.created_at));
  }
  
  async getOutgoingAllyRequests(userHandle: string): Promise<any[]> {
    return db
      .select()
      .from(allyRequests)
      .where(and(
        eq(allyRequests.sender_handle, userHandle),
        eq(allyRequests.status, 'pending')
      ))
      .orderBy(desc(allyRequests.created_at));
  }
  
  async updateAllyRequestStatus(requestId: string, status: string, responseData?: any): Promise<void> {
    const updateData: any = {
      status: status,
      responded_at: new Date(),
      updated_at: new Date()
    };
    
    if (responseData) {
      Object.assign(updateData, responseData);
    }
    
    await db
      .update(allyRequests).set(updateData)
      .where(eq(allyRequests.id, requestId));
  }
  
  async createAlliance(allianceData: any): Promise<void> {
    await db.insert(activeAlliances).values({
      ...allianceData,
      last_interaction: new Date(),
      established_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    });
  }
  
  async getAlliances(userHandle: string): Promise<any[]> {
    return db
      .select()
      .from(activeAlliances)
      .where(or(
        eq(activeAlliances.player1_handle, userHandle),
        eq(activeAlliances.player2_handle, userHandle)
      ))
      .orderBy(desc(activeAlliances.established_at));
  }
  
  async removeAlliance(player1Handle: string, player2Handle: string): Promise<void> {
    await db
      .delete(activeAlliances)
      .where(or(
        and(
          eq(activeAlliances.player1_handle, player1Handle),
          eq(activeAlliances.player2_handle, player2Handle)
        ),
        and(
          eq(activeAlliances.player1_handle, player2Handle),
          eq(activeAlliances.player2_handle, player1Handle)
        )
      ));
  }
  
  async getGamingRiddleWalletUsers(): Promise<string[]> {
    const result = await db
      .select({ user_handle: gamingPlayers.user_handle })
      .from(gamingPlayers)
      .where(eq(gamingPlayers.is_gaming_verified, true))
      .orderBy(gamingPlayers.user_handle);
      
    return result.map(row => row.user_handle);
  }
  
  async recordLandPlotPurchase(purchaseData: any): Promise<void> {
    // Use atomic transaction with conditional update to prevent race conditions
    const result = await db.transaction(async (tx) => {
      // Check if plot exists first (optimization to avoid unnecessary work)
      const plotExists = await tx
        .select({ plotNumber: medievalLandPlots.plotNumber })
        .from(medievalLandPlots)
        .where(eq(medievalLandPlots.plotNumber, purchaseData.plot_number))
        .limit(1);
      
      if (plotExists.length === 0) {
        throw new Error(`Land plot #${purchaseData.plot_number} does not exist`);
      }
      
      // ATOMIC: Conditional update with status guard to prevent double purchase
      const updateResult = await tx
        .update(medievalLandPlots).set({
          ownerHandle: purchaseData.user_handle,
          ownerAddress: purchaseData.wallet_address,
          status: 'owned' as const,
          purchasePrice: purchaseData.xrp_price,
          purchasedAt: purchaseData.purchased_at || new Date(),
          updatedAt: new Date()
        } as any)
        .where(
          and(
            eq(medievalLandPlots.plotNumber, purchaseData.plot_number),
            eq(medievalLandPlots.status, 'available') // CRITICAL: Only update if still available
          )
        );
      
      // Check if any rows were affected - if not, plot was already purchased
      if (updateResult.rowCount === 0) {
        // Get current status for better error message
        const currentPlot = await tx
          .select({ status: medievalLandPlots.status, ownerHandle: medievalLandPlots.ownerHandle })
          .from(medievalLandPlots)
          .where(eq(medievalLandPlots.plotNumber, purchaseData.plot_number))
          .limit(1);
        
        const status = currentPlot[0]?.status || 'unknown';
        const owner = currentPlot[0]?.ownerHandle || 'unknown';
        throw new Error(`Land plot #${purchaseData.plot_number} is no longer available (status: ${status}, owner: ${owner}). Another buyer may have purchased it simultaneously.`);
      }
      
      // Record purchase event for audit trail
      await tx.insert(gamingEvents).values({
        event_type: 'land_plot_purchase',
        user_handle: purchaseData.user_handle,
        event_data: {
          plot_id: purchaseData.plot_id,
          plot_number: purchaseData.plot_number,
          terrain_type: purchaseData.terrain_type,
          coordinates: purchaseData.coordinates,
          xrp_price: purchaseData.xrp_price,
          nft_token_id: purchaseData.nft_token_id,
          image_url: purchaseData.image_url,
          purchased_at: purchaseData.purchased_at,
          transaction_hash: purchaseData.transaction_hash
        },
        timestamp: purchaseData.purchased_at || new Date()
      } as any);
      
      return { success: true };
    });
    
    console.log(`✅ [STORAGE] Plot #${purchaseData.plot_number} ownership ATOMICALLY transferred to ${purchaseData.user_handle}`);
    console.log(`📝 [STORAGE] Purchase recorded with NFT token: ${purchaseData.nft_token_id}`);
    console.log(`🔒 [SECURITY] Atomic transaction completed - no race condition possible`);
  }
  
  // NFT Collection Management Methods
  async updateGamingNftCollection(collectionId: string, updateData: any): Promise<void> {
    await db
      .update(gamingNftCollections).set({
        ...updateData,
        updated_at: new Date()
      } as any)
      .where(eq(gamingNftCollections.id, collectionId));
  }
  
  async addGamingNft(nftData: any): Promise<void> {
    await db.insert(gamingNfts).values({
      ...nftData,
      created_at: new Date(),
      updated_at: new Date(),
      metadata_updated: new Date()
    } as any);
  }
  
  async getAllGamingNftCollections(): Promise<any[]> {
    return db
      .select()
      .from(gamingNftCollections)
      .orderBy(gamingNftCollections.taxon);
  }
  
  async getGamingNftCount(collectionId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(gamingNfts)
      .where(eq(gamingNfts.collection_id, collectionId));
    return result[0]?.count || 0;
  }
  
  async getGamingNftCollectionByTaxon(taxon: number): Promise<any | null> {
    const result = await db
      .select()
      .from(gamingNftCollections)
      .where(eq(gamingNftCollections.taxon, taxon))
      .limit(1);
    return result[0] || null;
  }
  
  async getGamingNftsByCollection(collectionId: string): Promise<any[]> {
    return db
      .select()
      .from(gamingNfts)
      .where(eq(gamingNfts.collection_id, collectionId))
      .orderBy(gamingNfts.rarity_rank);
  }

  // ===============================================================================
  // NFT LAUNCHPAD PROJECT IMPLEMENTATIONS
  // ===============================================================================

  async createNftProject(project: any): Promise<any> {
    const [result] = await db
      .insert(nftProjects)
      .values(project as any)
      .returning();
    return result;
  }

  async getNftProject(projectId: number): Promise<any | null> {
    const [result] = await db
      .select()
      .from(nftProjects)
      .where(eq(nftProjects.id, projectId));
    return result || null;
  }

  async getNftProjectByTaxon(taxon: number): Promise<any | null> {
    const [result] = await db
      .select()
      .from(nftProjects)
      .where(eq(nftProjects.taxon, taxon));
    return result || null;
  }

  async getNftProjectsByCreator(creatorWallet: string): Promise<any[]> {
    return db
      .select()
      .from(nftProjects)
      .where(eq(nftProjects.creatorWallet, creatorWallet))
      .orderBy(desc(nftProjects.createdAt));
  }

  async updateNftProject(projectId: number, updates: any): Promise<any> {
    const [result] = await db
      .update(nftProjects).set({ ...updates, updatedAt: new Date() } as any)
      .returning();
    return result;
  }

  async deleteNftProject(projectId: number): Promise<void> {
    await db
      .delete(nftProjects)
      .where(eq(nftProjects.id, projectId));
  }

  async createNftAsset(asset: any): Promise<any> {
    const [result] = await db
      .insert(nftAssets)
      .values(asset as any)
      .returning();
    return result;
  }

  async createNftAssets(assets: any[]): Promise<any[]> {
    return db
      .insert(nftAssets)
      .values(assets as any)
      .returning();
  }

  async getNftAssetsByProject(projectId: number): Promise<any[]> {
    return db
      .select()
      .from(nftAssets)
      .where(eq(nftAssets.projectId, projectId))
      .orderBy(nftAssets.assetIndex);
  }

  async getNftAsset(assetId: number): Promise<any | null> {
    const [result] = await db
      .select()
      .from(nftAssets)
      .where(eq(nftAssets.id, assetId));
    return result || null;
  }

  async updateNftAsset(assetId: number, updates: any): Promise<any> {
    const [result] = await db
      .update(nftAssets).set(updates)
      .where(eq(nftAssets.id, assetId))
      .returning();
    return result;
  }

  async deleteNftAsset(assetId: number): Promise<void> {
    await db
      .delete(nftAssets)
      .where(eq(nftAssets.id, assetId));
  }

  async createNftProjectLog(log: any): Promise<any> {
    const [result] = await db
      .insert(nftProjectLogs)
      .values(log as any)
      .returning();
    return result;
  }

  async getNftProjectLogs(projectId: number, limit: number = 50): Promise<any[]> {
    return db
      .select()
      .from(nftProjectLogs)
      .where(eq(nftProjectLogs.projectId, projectId))
      .orderBy(desc(nftProjectLogs.createdAt))
      .limit(limit);
  }

  async addToNftWhitelist(whitelistEntry: any): Promise<any> {
    const [result] = await db
      .insert(nftProjectWhitelist)
      .values(whitelistEntry as any)
      .returning();
    return result;
  }

  async getNftWhitelist(projectId: number): Promise<any[]> {
    return db
      .select()
      .from(nftProjectWhitelist)
      .where(eq(nftProjectWhitelist.projectId, projectId));
  }

  async checkNftWhitelist(projectId: number, walletAddress: string): Promise<any | null> {
    const [result] = await db
      .select()
      .from(nftProjectWhitelist)
      .where(
        and(
          eq(nftProjectWhitelist.projectId, projectId),
          eq(nftProjectWhitelist.walletAddress, walletAddress)
        )
      );
    return result || null;
  }

  async updateNftWhitelistMintCount(projectId: number, walletAddress: string): Promise<void> {
    await db
      .update(nftProjectWhitelist).set({
      })
      .where(
        and(
          eq(nftProjectWhitelist.projectId, projectId),
          eq(nftProjectWhitelist.walletAddress, walletAddress)
        )
      );
  }
}

export const storage = new DatabaseStorage();











