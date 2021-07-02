import { IpfsService } from "services/IpfsService";
import { autoinject } from "aurelia-framework";
import { BaseStage } from "newSeed/baseStage";
import { Router, RouteConfig, Redirect } from "aurelia-router";
import { SeedService } from "services/SeedService";
import { EventAggregator } from "aurelia-event-aggregator";
import { EventConfigException } from "services/GeneralEvents";
import { fromWei } from "services/EthereumService";
import { NumberService } from "services/NumberService";
import { ContractNames, ContractsService } from "services/ContractsService";

@autoinject
export class Stage7 extends BaseStage {

  constructor(
    router: Router,
    eventAggregator: EventAggregator,
    private contractsService: ContractsService,
    private seedService: SeedService,
    private ipfsService: IpfsService,
    private numberService: NumberService) {
    super(router, eventAggregator);
  }

  public async canActivate(_params: unknown, routeConfig: RouteConfig): Promise<boolean | Redirect> {
    /**
     * heuristic for whether we have data.  Possibility is that the user
     * has used the 'back' button or otherwize figured out how to return
     * to this page, for example, just after having submitting a Seed,
     * where the seedConfig will have been deleted.
     */
    if (!routeConfig.settings.seedConfig.general.projectName?.length) {
      return new Redirect("");
    } else {
      return true;
    }
  }

  attached(): void {
    // this.seedConfig.seedDetails.fundingMax = toWei("100").toString();
    // this.seedConfig.seedDetails.pricePerToken = toWei(".5").toString();
    // this.wizardState.seedTokenSymbol = "PRIME";
    const distributableSeeds = this.numberService.fromString(fromWei(this.seedConfig.seedDetails.fundingMax))
      / this.numberService.fromString(fromWei(this.seedConfig.seedDetails.pricePerToken));
    this.wizardState.requiredSeedFee = distributableSeeds * this.seedFee;
    this.wizardState.requiredSeedDeposit = distributableSeeds + this.wizardState.requiredSeedFee;
    this.wizardState.primeDaoAddress = this.contractsService.getContractAddress(ContractNames.PrimeDAO);
  }

  async submit(): Promise<void> {
    try {
      this.eventAggregator.publish("seed.creating", true);
      this.wizardState.seedHash = await this.seedService.deploySeed(this.seedConfig);
      // this.eventAggregator.publish("handleInfo", `Successfully pinned seed registration hash at: this.ipfsService.getIpfsUrl(this.seedHash)`);
      this.seedConfig.clearState();
      this.stageStates.forEach((stage: { verified: boolean }, index: number) => {
        if (index > 0) {
          stage.verified = false;
        }
      });
      this.eventAggregator.publish("seed.clearState", true);
      this.next();
    } catch (ex) {
      this.eventAggregator.publish("handleException", new EventConfigException("Sorry, an error occurred", ex));
    }
    finally {
      this.eventAggregator.publish("seed.creating", false);
    }
  }
}
