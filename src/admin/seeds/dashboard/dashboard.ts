import { Utils } from "services/utils";
import { TransactionReceipt } from "services/TransactionsService";
import { Seed } from "entities/Seed";
import { Address, EthereumService } from "services/EthereumService";
import { autoinject, computedFrom } from "aurelia-framework";
import { SeedService } from "services/SeedService";
import "./dashboard.scss";
import { EventAggregator } from "aurelia-event-aggregator";
import { DisposableCollection } from "services/DisposableCollection";
import { EventConfigException } from "services/GeneralEvents";
import { WhiteListService } from "services/WhiteListService";
import { BigNumber } from "ethers";
import { Router } from "aurelia-router";
import { AddClassService } from "services/AddClassService";
import { IContributorClass } from "entities/Seed";

@autoinject
export class SeedAdminDashboard {

  seeds: Array<Seed> = [];
  defaultSeedAddress: Address;
  selectedSeed: Seed;
  selectedSeedIndex: number;
  addressToRemove = "";
  addressToAdd = "";
  receiverAddress = "";
  subscriptions: DisposableCollection = new DisposableCollection();
  loading = true;

  @computedFrom("ethereumService.defaultAccountAddress")
  get connected(): boolean {
    return !!this.ethereumService.defaultAccountAddress;
  }

  @computedFrom("selectedSeed")
  get retrievableProjectTokenAmount(): BigNumber {
    if (!this.selectedSeed.address) {
      return BigNumber.from(0);
    }
    const tokenToBeDistributed = this.selectedSeed.seedAmountRequired.sub(this.selectedSeed.seedRemainder).sub(this.selectedSeed.feeRemainder);
    return this.selectedSeed.minimumReached ?
      this.selectedSeed.projectTokenBalance.sub(tokenToBeDistributed) :
      this.selectedSeed.projectTokenBalance;
  }

  constructor(
    private eventAggregator: EventAggregator,
    private seedService: SeedService,
    private ethereumService: EthereumService,
    private whiteListService: WhiteListService,
    private router: Router,
    private addClassService: AddClassService,
  ) {
    this.subscriptions.push(this.eventAggregator.subscribe("Network.Changed.Account", async () => {
      this.hydrate();
    }));
  }

  async activate(params: { address: Address }): Promise<void> {
    this.defaultSeedAddress = params?.address;
  }

  async attached(): Promise<void> {

    try {
      if (this.seedService.initializing) {
        this.eventAggregator.publish("launches.loading", true);
        await this.seedService.ensureAllSeedsInitialized();
      }
      await this.hydrate();

    } catch (ex) {
      this.eventAggregator.publish("handleException", new EventConfigException("Sorry, an error occurred", ex));
    }
    finally {
      this.eventAggregator.publish("launches.loading", false);
      this.loading = false;
    }
  }

  async hydrate(): Promise<void> {
    if (this.ethereumService.defaultAccountAddress) {
      const defaultAccount: Address = this.ethereumService.defaultAccountAddress.toLowerCase();
      this.seeds = this.seedService.seedsArray
        .filter((seed) => { return seed.admin.toLowerCase() === defaultAccount;});
      if (this.seeds.length === 1){
        this.selectedSeed = this.seeds[0];
        this.selectedSeedIndex = 0;
      }
    } else {
      this.seeds = [];
    }
    if (this.defaultSeedAddress) {
      const defaultSeed = this.seeds.filter((seed) => this.defaultSeedAddress === seed.address);
      if (defaultSeed.length === 1) {
        this.selectedSeedIndex = this.seeds.indexOf(defaultSeed[0]);
        this.selectedSeed = defaultSeed[0];
      }
    }
  }

  @computedFrom("selectedSeed.isDead")
  get isDead(): boolean {
    return this.selectedSeed.isDead;
  }

  selectSeed(index: number): void {
    this.selectedSeed = this.seeds[index];
    this.selectedSeedIndex = index;
    this.router.navigate(`admin/seeds/dashboard/${this.selectedSeed.address}`);
  }

  private hasValidatedAddress(address:Address, message: string): boolean {
    if (!Utils.isAddress(address)){
      this.eventAggregator.publish("handleValidationError", message);
      return false;
    }
    return true;
  }

  addToWhiteList(): void {
    if (this.hasValidatedAddress(this.addressToAdd, "Please supply a valid address to add to whitelist")) {
      this.selectedSeed.addToWhitelist(this.addressToAdd);
    }
  }

  removeFromWhiteList(): void {
    if (this.hasValidatedAddress(this.addressToRemove, "Please supply a valid address to remove from whitelist")) {
      this.selectedSeed.removeFromWhitelist(this.addressToRemove);
    }
  }

  retrieveProjectTokens(): void {
    if (this.hasValidatedAddress(this.receiverAddress, "Please supply a valid address to receive project tokens")) {
      this.selectedSeed.retrieveProjectTokens(this.receiverAddress);
    }
  }

  async addWhitelist(): Promise<TransactionReceipt> {
    const whitelistAddress: Set<Address> = await this.whiteListService.getWhiteList(this.selectedSeed.metadata.launchDetails.whitelist);
    return await this.selectedSeed.addWhitelist(whitelistAddress);
  }

  connect(): void {
    this.ethereumService.ensureConnected();
  }

  private navigate(href: string): void {
    this.router.navigate(href);
  }



  addClass(newClass: IContributorClass): void {
    if (!this.selectedSeed.classes) this.selectedSeed.classes = [];
    this.selectedSeed.classes.push(newClass);
  }

  editClass({ index, editedClass }: { index: number, editedClass: IContributorClass; }): void {
    Object.assign(this.selectedSeed.classes[index], editedClass);
  }

  openAddClassModal(index: number = null): void {
    const editedClass = index !== null ? { ...this.selectedSeed.classes[index] } : undefined;
    this.addClassService.show(
      { index, editedClass },
      this.addClass.bind(this),
      this.editClass.bind(this)
    );
  }

  deployClassesToContract() {
    // TODO: Add deployment logic
    // Differentiate between edited and newly added classes.
    // Step 1: Deploy batched classes
    // Step 2: Deploy bached Allowed Lists corresponding to the classes
    alert("Deploying Classes to contract")
  }

  cancel() {
    // TODO: Add cancel logic.
    // Remove new add classes
    // Undo edit
    this.selectedSeed.classes = []; /* <- Temporary */
  }
}
