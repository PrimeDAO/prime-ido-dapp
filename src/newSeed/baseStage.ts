import { EventConfigFailure } from "../services/GeneralEvents";
import { autoinject, singleton, computedFrom } from "aurelia-framework";
import "./baseStage.scss";
import { ISeedConfig } from "./seedConfig";
import { RouteConfig } from "aurelia-router";
import { Router } from "aurelia-router";
import { EventAggregator } from "aurelia-event-aggregator";
import { Address, Hash } from "services/EthereumService";

export interface IStageState {
  verified: boolean;
  title: string;
}

export interface IWizardState {
  seedHash?: Hash;
  whiteList?: string;
  fundingTokenSymbol?: string;
  fundingTokenIcon?: string;
  seedTokenSymbol?: string;
  seedTokenIcon?: string;
  requiredSeedDeposit?: number;
  requiredSeedFee?: number;
  seedAdminAddress?: Address;
}

@singleton(false)
@autoinject
export abstract class BaseStage {
  protected seedConfig: ISeedConfig;
  protected stageNumber: number;
  protected maxStage: number;
  protected stageStates: Array<IStageState>;
  protected wizardState: IWizardState;

  @computedFrom("stageStates", "stageNumber")
  protected get stageState(): IStageState { return this.stageStates[this.stageNumber]; }

  protected readonly seedFee = .01;

  constructor(
    protected router: Router,
    protected eventAggregator: EventAggregator) {
  }

  activate(_params: unknown, routeConfig: RouteConfig): void {
    Object.assign(this, routeConfig.settings);
  }

  async detached(): Promise<void> {
    const message = await this.validateInputs();
    if (!message) {
      this.persistData();
    }
  }

  protected cancel(): void {
    this.router.parent.navigate("launch");
  }

  protected next(): void {
    this.router.navigate(`stage${this.stageNumber + 1}`);
  }

  protected back(): void {
    if (this.stageNumber > 1) {
      this.router.navigate(`stage${this.stageNumber - 1}`);
    }
  }

  protected async proceed(moveOn = true): Promise<boolean> {
    const message: string = await this.validateInputs();
    if (message) {
      this.validationError(message);
      return false;
    } else {
      if (moveOn) {
        this.next();
      }
      return true;
    }
  }

  protected validateInputs(): Promise<string> {
    return Promise.resolve(null);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  protected persistData(): void {
  }

  protected validationError(message: string): void {
    this.eventAggregator.publish("handleValidationError", new EventConfigFailure(message));
  }
}
