import { TransactionReceipt } from "services/TransactionsService";
import { Seed } from "../entities/Seed";
import { Address, EthereumService } from "services/EthereumService";
import { autoinject, computedFrom } from "aurelia-framework";
import { SeedService } from "services/SeedService";
import "./seedAdminDashboard.scss";
import { EventAggregator } from "aurelia-event-aggregator";
import { DisposableCollection } from "services/DisposableCollection";
import { EventConfigException } from "services/GeneralEvents";
import { WhiteListService } from "services/WhiteListService";
import { BigNumber } from "ethers";
import { formatUnits } from "@ethersproject/units";

@autoinject
export class SeedAdminDashboard {

  seeds: Array<Seed> = [];
  selectedSeed: Seed;
  addressToRemove = "";
  addressToAdd = "";
  receiverAddress = "";
  subscriptions: DisposableCollection = new DisposableCollection();
  loading = true;

  @computedFrom("ethereumService.defaultAccountAddress")
  get connected(): boolean {
    return !!this.ethereumService.defaultAccountAddress;
  }

  constructor(
    private eventAggregator: EventAggregator,
    private seedService: SeedService,
    private ethereumService: EthereumService,
    private whiteListService: WhiteListService,
  ) {
    this.subscriptions.push(this.eventAggregator.subscribe("Network.Changed.Account", async () => {
      this.hydrate();
    }));
  }

  async attached(): Promise<void> {

    try {
      if (this.seedService.initializing) {
        this.eventAggregator.publish("seeds.loading", true);
        await this.seedService.ensureAllSeedsInitialized();
      }
      await this.hydrate();

    } catch (ex) {
      this.eventAggregator.publish("handleException", new EventConfigException("Sorry, an error occurred", ex));
    }
    finally {
      this.eventAggregator.publish("seeds.loading", false);
      this.loading = false;
    }
  }

  async hydrate(): Promise<void> {
    if (this.ethereumService.defaultAccountAddress) {
      const defaultAccount: Address = this.ethereumService.defaultAccountAddress.toLowerCase();
      this.seeds = this.seedService.seedsArray
        .filter((seed) => { return seed.admin.toLowerCase() === defaultAccount;});
    } else {
      this.seeds = [];
    }
  }

  setSeed(index): void {
    this.selectedSeed = this.seeds[index];
  }

  convertFundingTokenAmount(amount: BigNumber): string {
    return formatUnits(amount, this.selectedSeed.fundingTokenInfo.decimals);
  }

  convertProjectTokenAmount(amount: BigNumber): string {
    return formatUnits(amount, this.selectedSeed.projectTokenInfo.decimals);
  }

  async addWhitelist(): Promise<TransactionReceipt> {
    const whitelistAddress: Set<Address> = await this.whiteListService.getWhiteList(this.selectedSeed.metadata.seedDetails.whitelist);
    return await this.selectedSeed.addWhitelist(whitelistAddress);
  }

  connect(): void {
    this.ethereumService.ensureConnected();
  }
}
