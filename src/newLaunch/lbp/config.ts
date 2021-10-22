import {
  ILaunchConfig,
  IGeneral,
  IProjectDetails,
  ITokenDetails,
  IContactDetails,
  ILaunchDetails,
  LaunchConfig,
} from "newLaunch/launchConfig";

export interface ILbpDetails extends ILaunchDetails {
  amountProjectToken: string,
  amountFundingToken: string,
  startWeight: number,
  endWeight: number,
}

export interface ILbpConfig extends ILaunchConfig {
  launchDetails: ILbpDetails,
}
export class LbpConfig extends LaunchConfig implements ILaunchConfig {
  public version: string;
  public general: IGeneral;
  public projectDetails:IProjectDetails;
  public tokenDetails: ITokenDetails;
  public contactDetails: IContactDetails;
  public launchDetails: ILbpDetails;

  clearState(): void {
    super.clearState();
    this.launchDetails.amountProjectToken = "";
    this.launchDetails.amountFundingToken = "";
    this.launchDetails.startWeight = 80;
    this.launchDetails.endWeight = 80;
  }
}
