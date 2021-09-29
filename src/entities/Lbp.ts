import { toBigNumberJs } from "services/BigNumberService";
import { IpfsService } from "services/IpfsService";
import { ITokenInfo } from "services/TokenService";
import { autoinject, computedFrom } from "aurelia-framework";
import { DateService } from "services/DateService";
import { ContractsService, ContractNames } from "services/ContractsService";
import { BigNumber } from "ethers";
import { Address, EthereumService, fromWei, Hash } from "services/EthereumService";
import { ConsoleLogService } from "services/ConsoleLogService";
import { TokenService } from "services/TokenService";
import { EventAggregator } from "aurelia-event-aggregator";
import { DisposableCollection } from "services/DisposableCollection";
import { NumberService } from "services/NumberService";
import TransactionsService, { TransactionReceipt } from "services/TransactionsService";
import { Utils } from "services/utils";
import { ILbpConfig } from "newLaunch/lbp/lbpConfig";

export interface ILbpConfiguration {
  address: Address;
  beneficiary: Address;
}

interface IFunderPortfolio {
  totalClaimed: BigNumber;
  fundingAmount: BigNumber;
  fee: BigNumber;
  feeClaimed: BigNumber;
}


@autoinject
export class Lbp {
  public contract: any;
  public address: Address;
  public lbpInitialized: boolean;
  public beneficiary: Address;
  public startTime: Date;
  public endTime: Date;
  public admin: Address;
  /**
   * a state set by the admin (creator) of the Lbp
   */
  public isPaused: boolean;
  /**
   * a state set by the admin (creator) of the Lbp
   */
  public isClosed: boolean;
  /**
   * The number of fundingTokens required to receive one projectToken,
   * ie, the price of one project (lbp) token in units of funding tokens.
   */
  public fundingTokensPerProjectToken: number;
  /**
   * in terms of fundingToken
   */
  public target: BigNumber;
  // public targetPrice: number;
  /**
   * in terms of fundingToken
   */
  public cap: BigNumber;
  // public capPrice: number;
  /**
   * LBP has a whitelist
   */
  public whitelisted: boolean;
  /**
   * the number of seconds of over which project tokens vest
   */
  public vestingDuration: number;
  /**
   * the initial period in seconds of the vestingDuration during which project tokens may not
   * be claimed
   */
  public vestingCliff: number;
  public minimumReached: boolean;
  /**
   * the amount of the fundingToken in the lbp
   */
  public amountRaised: BigNumber;
  /**
   * $ value of the total supply of the project (lbp) token
   */
  public valuation: number;
  /**
   * "lbp token" is a synonym for "project token"
   */
  public projectTokenAddress: Address;
  public projectTokenInfo: ITokenInfo;
  public projectTokenContract: any;
  /**
   * balance of project tokens in this contract
   */
  public projectTokenBalance: BigNumber;
  /**
   * number of tokens in this LBP contract
   */
  public lbpRemainder: BigNumber;
  /**
   * amount to be distributed, according to the funding cap and prices
   */
  public lbpAmountRequired: BigNumber;
  /**
   * Is the LBP contract initialized and have enough project tokens to pay its obligations
   */
  public hasEnoughProjectTokens: boolean;

  public feeRemainder: BigNumber;

  public fundingTokenAddress: Address;
  public fundingTokenInfo: ITokenInfo;
  public fundingTokenContract: any;

  public userIsWhitelisted: boolean;
  /**
   * claimable project (lbp) tokens
   */
  public userClaimableAmount: BigNumber;
  /**
   * pending (locked) project tokens
   */
  public userPendingAmount: BigNumber;
  public userCanClaim: boolean;
  public userCurrentFundingContributions: BigNumber;
  public userFundingTokenBalance: BigNumber;

  public initializing = true;
  public metadata: ILbpConfig;
  public metadataHash: Hash;
  public corrupt = false;
  public userHydrated = false;

  private initializedPromise: Promise<void>;
  private subscriptions = new DisposableCollection();
  private _now = new Date();

  @computedFrom("_now")
  public get startsInMilliseconds(): number {
    return this.dateService.getDurationBetween(this.startTime, this._now).asMilliseconds();
  }

  @computedFrom("_now")
  public get endsInMilliseconds(): number {
    return this.dateService.getDurationBetween(this.endTime, this._now).asMilliseconds();
  }

  @computedFrom("_now")
  public get hasNotStarted(): boolean {
    return (this._now < this.startTime);
  }
  /**
   * we are between the start and end dates.
   * Doesn't mean you can do anything.
   */
  @computedFrom("_now")
  public get isLive(): boolean {
    return (this._now >= this.startTime) && (this._now < this.endTime);
  }
  /**
   * we are after the end date.
   * No implications about whether you can do anything.
   */
  @computedFrom("_now")
  public get isDead(): boolean {
    return (this._now >= this.endTime);
  }

  @computedFrom("isLive", "uninitialized", "maximumReached", "isPaused", "isClosed")
  public get contributingIsOpen(): boolean {
    return this.isLive && !this.uninitialized && !this.maximumReached && !this.isPaused && !this.isClosed;
  }
  /**
   * Really means "complete".  But does not imply that the vesting cliff has actually ended.
   */
  @computedFrom("uninitialized", "maximumReached", "minimumReached", "isDead")
  get claimingIsOpen(): boolean {
    return !this.uninitialized && (this.maximumReached || (this.minimumReached && this.isDead));
  }
  /**
   * didn't reach the target and not paused or closed
   */
  @computedFrom("uninitialized", "minimumReached", "isDead", "isPaused", "isClosed")
  get incomplete(): boolean {
    return this.isDead && !this.uninitialized && !this.minimumReached && !this.isPaused && !this.isClosed;
  }

  @computedFrom("_now_")
  get retrievingIsOpen(): boolean {
    return (this._now >= this.startTime) && !this.minimumReached;
  }

  @computedFrom("userCurrentFundingContributions", "retrievingIsOpen")
  get userCanRetrieve(): boolean {
    return this.retrievingIsOpen && this.userCurrentFundingContributions?.gt(0);
  }

  @computedFrom("amountRaised")
  get maximumReached(): boolean {
    return this.amountRaised?.gte(this.cap);
  }

  @computedFrom("uninitialized")
  get canGoToDashboard(): boolean {
    return !this.uninitialized;
  }

  @computedFrom("hasEnoughProjectTokens")
  get uninitialized(): boolean {
    return !this.hasEnoughProjectTokens;
  }

  constructor(
    private contractsService: ContractsService,
    private consoleLogService: ConsoleLogService,
    private eventAggregator: EventAggregator,
    private dateService: DateService,
    private tokenService: TokenService,
    private transactionsService: TransactionsService,
    private numberService: NumberService,
    private ethereumService: EthereumService,
    private ipfsService: IpfsService,
  ) {
    this.subscriptions.push(this.eventAggregator.subscribe("secondPassed", async (state: {now: Date}) => {
      this._now = state.now;
    }));

    this.subscriptions.push(this.eventAggregator.subscribe("Contracts.Changed", async () => {
      await this.loadContracts().then(() => { this.hydrateUser(); });
    }));
  }

  public create(config: ILbpConfiguration): Lbp {
    this.initializedPromise = Utils.waitUntilTrue(() => !this.initializing, 9999999999);
    return Object.assign(this, config);
  }

  /**
   * note this is called when the contracts change
   * @param config
   * @returns
   */
  public async initialize(): Promise<void> {
    this.initializing = true;
    await this.loadContracts();
    /**
       * no, intentionally don't await
       */
    this.hydrate();
  }

  private async loadContracts(): Promise<void> {
    try {
      this.contract = await this.contractsService.getContractAtAddress(ContractNames.SEED, this.address);
      if (this.projectTokenAddress) {
        this.projectTokenContract = this.tokenService.getTokenContract(this.projectTokenAddress);
        this.fundingTokenContract = this.tokenService.getTokenContract(this.fundingTokenAddress);
      }
    }
    catch (error) {
      this.corrupt = true;
      this.initializing = false;
      this.consoleLogService.logMessage(`Lbp: Error initializing LBP: ${error?.message ?? error}`, "error");
    }
  }

  private async hydrate(): Promise<void> {
    try {
      await this.hydrateMetadata();

      this.lbpInitialized = await this.contract.initialized();
      this.admin = await this.contract.admin();
      this.projectTokenAddress = await this.contract.lbpToken();
      this.fundingTokenAddress = await this.contract.fundingToken();

      this.projectTokenInfo = await this.tokenService.getTokenInfoFromAddress(this.projectTokenAddress);
      this.fundingTokenInfo = await this.tokenService.getTokenInfoFromAddress(this.fundingTokenAddress);

      this.projectTokenContract = this.tokenService.getTokenContract(this.projectTokenAddress);
      this.fundingTokenContract = this.tokenService.getTokenContract(this.fundingTokenAddress);

      this.startTime = this.dateService.unixEpochToDate((await this.contract.startTime()).toNumber());
      this.endTime = this.dateService.unixEpochToDate((await this.contract.endTime()).toNumber());
      this.fundingTokensPerProjectToken = this.numberService.fromString(fromWei(await this.contract.price()));
      /**
       * in units of fundingToken
       */
      this.target = await this.contract.softCap();
      // this.targetPrice = this.numberService.fromString(fromWei(this.target)) * (this.fundingTokenInfo.price ?? 0);
      /**
       * in units of fundingToken
       */
      this.cap = await this.contract.hardCap();
      await this.hydateClosedOrPaused();
      // this.capPrice = this.numberService.fromString(fromWei(this.cap)) * (this.fundingTokenInfo.price ?? 0);
      this.whitelisted = await this.contract.permissionedLbp();
      this.vestingDuration = (await this.contract.vestingDuration());
      this.vestingCliff = (await this.contract.vestingCliff());
      this.valuation = this.numberService.fromString(fromWei(await this.fundingTokenContract.totalSupply()))
              * (this.fundingTokenInfo.price ?? 0);

      await this.hydrateTokensState();

      await this.hydrateUser();
    }
    catch (error) {
      this.corrupt = true;
      this.consoleLogService.logMessage(`Lbp: Error initializing LBP: ${error?.message ?? error}`, "error");
    } finally {
      this.initializing = false;
    }
  }

  public ensureInitialized(): Promise<void> {
    return this.initializedPromise;
  }

  private async hydrateUser(): Promise<void> {
    const account = this.ethereumService.defaultAccountAddress;

    this.userHydrated = false;

    if (account) {
      const lock: IFunderPortfolio = await this.contract.funders(account);
      this.userCurrentFundingContributions = lock.fundingAmount;

      this.userClaimableAmount = await this.contract.callStatic.calculateClaim(account);
      this.userCanClaim = this.userClaimableAmount.gt(0);
      this.userFundingTokenBalance = await this.fundingTokenContract.balanceOf(account);
      const lbpAmount = this.lbpsFromFunding(lock.fundingAmount);
      /**
       * LBPs that will be claimable, but are currently still vesting
       */
      this.userPendingAmount = lbpAmount.sub(lock.totalClaimed).sub(this.userClaimableAmount);
      this.userIsWhitelisted = !this.whitelisted ||
        this.userCanClaim || // can claim now
        this.userPendingAmount.gt(0) || // can eventually claim
        this.userCanRetrieve ||
        ((await this.contract.whitelisted(account))
        );
      this.userHydrated = true;
    }
  }

  private async hydrateMetadata(): Promise<void> {
    const rawMetadata = await this.contract.metadata();
    if (rawMetadata && Number(rawMetadata)) {
      this.metadataHash = Utils.toAscii(rawMetadata.slice(2));
      this.consoleLogService.logMessage(`loaded metadata: ${this.metadataHash}`, "info");
    } else {
      this.eventAggregator.publish("Lbp.InitializationFailed", this.address);
      throw new Error(`lbp lacks metadata, is unusable: ${this.address}`);
    }

    if (this.metadataHash) {
      this.metadata = await this.ipfsService.getObjectFromHash(this.metadataHash);
      if (!this.metadata) {
        this.eventAggregator.publish("Lbp.InitializationFailed", this.address);
        throw new Error(`LBP metadata is not found in IPFS, LBP is unusable: ${this.address}`);
      }
    }
  }

  private async hydrateTokensState(): Promise<void> {
    this.minimumReached = await this.contract.minimumReached();
    this.amountRaised = await this.contract.fundingCollected();
    this.lbpRemainder = await this.contract.lbpRemainder();
    this.lbpAmountRequired = await this.contract.lbpAmountRequired();
    this.feeRemainder = await this.contract.feeRemainder();
    this.projectTokenBalance = await this.projectTokenContract.balanceOf(this.address);
    this.hasEnoughProjectTokens =
      this.lbpInitialized && ((this.lbpRemainder && this.feeRemainder) ? this.projectTokenBalance?.gte(this.feeRemainder?.add(this.lbpRemainder)) : false);
  }


  private lbpsFromFunding(fundingAmount: BigNumber): BigNumber {
    const bnFundingAmount = toBigNumberJs(fundingAmount);
    if ((this.fundingTokensPerProjectToken > 0) && (fundingAmount.gt(0))) {
      return BigNumber.from(bnFundingAmount.idiv(this.fundingTokensPerProjectToken).toString());
    } else {
      return BigNumber.from(0);
    }
  }

  public buy(amount: BigNumber): Promise<TransactionReceipt> {
    return this.transactionsService.send(() => this.contract.buy(amount))
      .then(async (receipt) => {
        if (receipt) {
          this.hydrateTokensState();
          this.hydrateUser();
          return receipt;
        }
      });
  }

  public claim(amount: BigNumber): Promise<TransactionReceipt> {
    return this.transactionsService.send(() => this.contract.claim(this.ethereumService.defaultAccountAddress, amount))
      .then((receipt) => {
        if (receipt) {
          this.hydrateTokensState();
          this.hydrateUser();
          return receipt;
        }
      });
  }

  public fundingTokenAllowance(): Promise<BigNumber> {
    return this.fundingTokenContract.allowance(this.ethereumService.defaultAccountAddress, this.address);
  }

  public unlockFundingTokens(amount: BigNumber): Promise<TransactionReceipt> {
    return this.transactionsService.send(() => this.fundingTokenContract.approve(this.address, amount));
  }

  public retrieveFundingTokens(): Promise<TransactionReceipt> {
    return this.transactionsService.send(() => this.contract.retrieveFundingTokens())
      .then((receipt) => {
        if (receipt) {
          this.hydrateTokensState();
          this.hydrateUser();
          return receipt;
        }
      });
  }

  public async hydateClosedOrPaused(): Promise<boolean> {
    this.isPaused = await this.contract.paused();
    this.isClosed = await this.contract.closed();
    return this.isPaused || this.isClosed;
  }
}
