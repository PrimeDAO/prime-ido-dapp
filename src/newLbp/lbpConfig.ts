/* eslint-disable @typescript-eslint/consistent-type-assertions */
export const SocialLinkNames = [
  "Twitter",
  "Discord",
  "Telegram",
  "Reddit",
  "LinkedIn",
];

export const CategoryNames = [
  "Assets",
  "L1 protocol",
  "L2 protocol",
  "Lending",
  "NFT",
  "Options",
  "Staking",
  "Stablecoin",
];

export class SocialLinkSpec {
  public media: string;
  public url: string;
}

export interface IGeneral {
  projectName: string,
  projectWebsite: string,
  category: string,
  whitepaper: string,
  github: string,
  customLinks: Array<SocialLinkSpec>
}

export interface IProjectDetails {
  summary: string,
  proposition: string,
  teamDescription: string,
  logo: string
}

export interface ITokenDetails {
  projectTokenAddress: string,
  /**
   * In wei, maximum ever total supply of project tokens
   */
  maxProjectTokenSupply: string,
  /**
   * In wei,
   */
  tokenDistrib: Array<{
    stakeHolder: string,
    /**
     * In wei
     */
    amount: string,
    /**
     * In days
     */
    cliff: number,
    vest: number
  }>
}

export interface ILbpDetails {
  fundingTokenAddress: string,
  amountProjectToken: string,
  amountFundingToken: string,
  startDate: string,
  endDate: string,
  startWeight: number,
  endWeight: number,
  legalDisclaimer: boolean,
}

export interface IContactDetails {
  contactEmail: string,
  remarks: string
}

export interface ILbpConfig {
  /**
   * semantic version of this interface. This value must be updated upon any released changes.
   */
  version: string;
  general: IGeneral,
  projectDetails: IProjectDetails,
  tokenDetails: ITokenDetails,
  contactDetails: IContactDetails,
  lbpDetails: ILbpDetails,
  clearState: () => void,
}

export class LbpConfig implements ILbpConfig {
  public version: string;
  public general: IGeneral;
  public projectDetails:IProjectDetails;
  public tokenDetails: ITokenDetails;
  public contactDetails: IContactDetails;
  public lbpDetails: ILbpDetails;

  constructor() {
    this.clearState();
  }

  clearState(): void {
    this.version = "1.0.0";
    this.general = {
      projectName: "",
      category: "",
      customLinks: [],
    } as IGeneral;
    this.projectDetails = {
      summary: "",
      proposition: "",
      teamDescription: "",
    } as IProjectDetails;
    this.tokenDetails = {
      tokenDistrib: [],
    } as ITokenDetails;
    this.lbpDetails = {
      fundingTokenAddress: "",
      amountFundingToken: "",
      amountProjectToken: "",
      startWeight: 80,
      endWeight: 80,
    } as ILbpDetails;
    this.contactDetails={
      remarks: "",
    } as IContactDetails;
  }
}
