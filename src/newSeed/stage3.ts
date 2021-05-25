import { autoinject } from "aurelia-framework";
import { Router } from "aurelia-router";
import { BaseStage } from "newSeed/baseStage";
import { ITokenInfo, TokenService } from "services/TokenService";
import { EventAggregator } from "aurelia-event-aggregator";
import { Utils } from "services/utils";

@autoinject
export class Stage3 extends BaseStage {
  constructor(
    eventAggregator: EventAggregator,
    private tokenService: TokenService,
    router: Router,
  ) {
    super(router, eventAggregator);
  }
  addTokenDistribution(): void {
    // Create a new custom link object
    this.seedConfig.tokenDetails.tokenDistrib.push({category: undefined, amount: undefined, lockup: undefined});
  }
  proceed(): void {
    const message: string = this.validateInputs();
    if (message) {
      this.validationError(message);
      this.stageState.verified = false;
    } else {
      this.stageState.verified = true;
      this.next();
    }
  }

  validateInputs(): string {
    let message: string;
    if (!Utils.isAddress(this.seedConfig.tokenDetails.fundingAddress)) {
      message = "Please enter a valid address for the Funding Token Address";
    } else if (!Utils.isAddress(this.seedConfig.tokenDetails.seedAddress)) {
      message = "Please enter a valid address for the Seed Token Address";
    }
    // else if (!this.seedConfig.tokenDetails.maxSupply || this.seedConfig.tokenDetails.maxSupply === "0") {
    //   message = "Please enter a non-zero number for Maximum Supply";
    // }
    // else if (!this.seedConfig.tokenDetails.initSupply || this.seedConfig.tokenDetails.initSupply === "0") {
    //   message = "Please enter a non-zero number for Initial Supply";
    // }
    // Check the token distribution
    this.seedConfig.tokenDetails.tokenDistrib.forEach((tokenDistrb: {category: string, amount: string, lockup: number}) => {
      if (!tokenDistrb.category) {
        message = "Please enter a value for Category";
      } else if (!tokenDistrb.amount || tokenDistrb.amount === "0") {
        message = `Please enter a non-zero number for Category ${tokenDistrb.category} Amount`;
      } else if (!(tokenDistrb.lockup > 0)) {
        message = `Please enter a non-zero number for Category ${tokenDistrb.category} Lock-up`;
      }
    });
    return message;
  }
  // TODO: Add a loading comp to the view while fetching
  getTokenInfo(type: string): void {
    if (type === "fund" && this.seedConfig.tokenDetails.fundingAddress) {
      this.tokenService.getTokenInfoFromAddress(this.seedConfig.tokenDetails.fundingAddress).then((tokenInfo: ITokenInfo) => {
        this.seedConfig.tokenDetails.fundingSymbol = (tokenInfo.symbol !== "N/A") ? tokenInfo.symbol : undefined;
      }).catch(() => {
        this.validationError("Could not get token info from the address supplied");
      });
    } else if (type === "seed" && this.seedConfig.tokenDetails.seedAddress) {
      this.tokenService.getTokenInfoFromAddress(this.seedConfig.tokenDetails.seedAddress).then((tokenInfo: ITokenInfo) => {
        this.seedConfig.tokenDetails.seedSymbol = (tokenInfo.symbol !== "N/A") ? tokenInfo.symbol : undefined;
      }).catch(() => {
        this.validationError("Could not get token info from the address supplied");
      });
    }
  }

}
