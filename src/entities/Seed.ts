import { IpfsService } from "./../services/IpfsService";
import { ITokenInfo } from "./../services/TokenService";
import { autoinject, computedFrom } from "aurelia-framework";
import { DateService } from "./../services/DateService";
import { ContractsService, ContractNames } from "./../services/ContractsService";
import { BigNumber } from "ethers";
import { Address, EthereumService, fromWei, Hash } from "services/EthereumService";
import { ConsoleLogService } from "services/ConsoleLogService";
import { TokenService } from "services/TokenService";
import { EventAggregator } from "aurelia-event-aggregator";
import { DisposableCollection } from "services/DisposableCollection";
import { NumberService } from "services/numberService";
import TransactionsService, { TransactionReceipt } from "services/TransactionsService";
import { Utils } from "services/utils";
import { ISeedConfig } from "newSeed/seedConfig";

export interface ISeedConfiguration {
  address: Address;
  beneficiary: Address;
}

@autoinject
export class Seed {
  public contract: any;
  public address: Address;
  public beneficiary: Address;
  public startTime: Date;
  public endTime: Date;
  /**
   * a state set by the admin (creator) of the Seed
   */
  public isPaused: boolean;
  /**
   * a state set by the admin (creator) of the Seed
   */
  public isClosed: boolean;
  /**
   * The number of fundingTokens required to receive one seedToken,
   * ie, the price of one seed token in units of funding tokens.
   */
  public fundingTokensPerSeedToken: number;
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
  public whitelisted: boolean;
  /**
   * the number of days of which seed tokens vest
   */
  public vestingDuration: number;
  /**
   * the initial period in days of the vestingDuration during which seed tokens may not
   * be redeemd
   */
  public vestingCliff: number;
  public minimumReached: boolean;
  public maximumReached: boolean;
  /**
   * the amount of the fundingToken in the seed
   */
  public amountRaised: BigNumber;
  /**
   * $ value of the total supply of the seed token
   */
  public valuation: number;

  public seedTokenAddress: Address;
  public seedTokenInfo: ITokenInfo;
  public seedTokenContract: any;
  /**
   * number of tokens in this seed contract
   */
  public seedTokenCurrentBalance: BigNumber;

  public fundingTokenAddress: Address;
  public fundingTokenInfo: ITokenInfo;
  public fundingTokenContract: any;

  public userIsWhitelisted: boolean;
  public userClaimableAmount: BigNumber;
  public userCanClaim: boolean;
  public userCurrentFundingContributions: BigNumber;

  public initializing = true;
  public metadata: ISeedConfig;

  private initializedPromise: Promise<void>;
  private subscriptions = new DisposableCollection();
  private _now = new Date();
  private metadataHash: Hash;

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

  @computedFrom("_now")
  public get canContribute(): boolean {
    return this.isLive && !this.maximumReached && !this.isPaused && !this.isClosed;
  }
  /**
   * it is theoretically possible to claim
   */
  @computedFrom("_now_")
  get claimingIsOpen(): boolean { return (this.maximumReached || (this.minimumReached && (this._now >= this.endTime)) && !this.isPaused && !this.isClosed); }

  @computedFrom("_now_")
  get retrievingIsOpen(): boolean { return !this.minimumReached && !this.isPaused && !this.isClosed; }

  @computedFrom("seedTokenCurrentBalance")
  get hasSeedTokens():boolean {
    return !!this.seedTokenCurrentBalance?.gt(0);
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

  public create(config: ISeedConfiguration): Seed {
    this.initializedPromise = Utils.waitUntilTrue(() => !this.initializing, 9999999999);
    return Object.assign(this, config);
  }

  /**
   * note this is called when the contracts change
   * @param config
   * @returns
   */
  public async initialize(): Promise<Seed> {

    await this.loadContracts();
    /**
     * no, intentionally don't await
     */
    this.hydrate();

    return this;
  }

  private async loadContracts(): Promise<void> {
    this.contract = await this.contractsService.getContractAtAddress(ContractNames.SEED, this.address);
    if (this.seedTokenAddress) {
      this.seedTokenContract = this.tokenService.getTokenContract(this.seedTokenAddress);
      this.fundingTokenContract = this.tokenService.getTokenContract(this.fundingTokenAddress);
    }
  }

  private async hydrate(): Promise<void> {
    this.initializing = true;
    try {
      this.seedTokenAddress = await this.contract.seedToken();
      this.fundingTokenAddress = await this.contract.fundingToken();

      this.seedTokenInfo = await this.tokenService.getTokenInfoFromAddress(this.seedTokenAddress);
      this.fundingTokenInfo = await this.tokenService.getTokenInfoFromAddress(this.fundingTokenAddress);

      this.seedTokenContract = this.tokenService.getTokenContract(this.seedTokenAddress);
      this.fundingTokenContract = this.tokenService.getTokenContract(this.fundingTokenAddress);

      this.amountRaised = await this.fundingTokenContract.balanceOf(this.address);

      this.startTime = this.dateService.unixEpochToDate((await this.contract.startTime()).toNumber());
      this.endTime = this.dateService.unixEpochToDate((await this.contract.endTime()).toNumber());
      this.fundingTokensPerSeedToken = this.numberService.fromString(fromWei(await this.contract.price()));
      /**
       * in units of fundingToken
       */
      this.target = await this.contract.successMinimum();
      // this.targetPrice = this.numberService.fromString(fromWei(this.target)) * (this.fundingTokenInfo.price ?? 0);
      /**
       * in units of fundingToken
       */
      this.cap = await this.contract.cap();
      this.isPaused = await this.contract.paused();
      this.isClosed = await this.contract.closed();
      // this.capPrice = this.numberService.fromString(fromWei(this.cap)) * (this.fundingTokenInfo.price ?? 0);
      this.whitelisted = await this.contract.isWhitelisted();
      this.vestingDuration = await this.contract.vestingDuration();
      this.vestingCliff = await this.contract.vestingCliff();
      this.minimumReached = await this.contract.minimumReached();
      this.maximumReached = this.amountRaised.gte(this.cap);
      this.valuation = this.numberService.fromString(fromWei(await this.fundingTokenContract.totalSupply()))
              * (this.fundingTokenInfo.price ?? 0);
      this.seedTokenCurrentBalance = await this.seedTokenContract.balanceOf(this.address);
      /**
       * TODO: unstub this
       */
      this.metadataHash = "QmarQL5q4i87TtTewuor5FLKVZ6FLd8qAs4qk2824UN184"; // await this.contract.metadata();

      await this.hydateMetadata();

      await this.hydrateUser();

      this.initializing = false;
    }
    catch (error) {
      this.consoleLogService.logMessage(`Seed: Error hydrating seed data ${error?.message}`, "error");
      this.initializing = false;
    }
  }

  public ensureInitialized(): Promise<void> {
    return this.initializedPromise;
  }

  private async hydrateUser(): Promise<void> {
    const account = this.ethereumService.defaultAccountAddress;

    if (account) {
      this.userIsWhitelisted = !this.whitelisted || (await this.contract.checkWhitelisted(account));
      this.userClaimableAmount = (await this.contract.calculateClaim(account))[1];
      this.userCanClaim = this.userClaimableAmount.gt(0);
      const lock = await this.contract.tokenLocks(account);
      this.userCurrentFundingContributions = lock ? lock.fundingAmount : BigNumber.from(0);
    }
  }

  private async hydateMetadata(): Promise<void> {
    this.metadata = await this.ipfsService.getObjectFromHash(this.metadataHash);
  }

  public buy(amount: BigNumber): Promise<TransactionReceipt> {
    return this.transactionsService.send(() => this.contract.buy(amount))
      .then((receipt) => {
        if (receipt) {
          this.hydrateUser();
          return receipt;
        }
      });
  }

  public claim(): Promise<TransactionReceipt> {
    return this.transactionsService.send(() => this.contract.claimLock(this.ethereumService.defaultAccountAddress))
      .then((receipt) => {
        if (receipt) {
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
    return this.transactionsService.send(() => this.fundingTokenContract.retrieveFundingTokens(this.address));
  }
}
