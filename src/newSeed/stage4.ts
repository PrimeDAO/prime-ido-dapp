import { DateService } from "./../services/DateService";
import { BaseStage } from "newSeed/baseStage";
import Litepicker from "litepicker";

export class Stage4 extends BaseStage {
  startDateRef: HTMLElement | HTMLInputElement;
  endDateRef: HTMLElement | HTMLInputElement;
  startDate: Date;
  startDateUi: string;
  startTime: string;
  endDate: Date;
  endDateUi: string;
  endTime: string;
  dateService = new DateService();
  startDatePicker: Litepicker;
  endDatePicker: Litepicker;

  attached(): void {
    console.log(this.startDateUi);
    if (!this.startDatePicker) {
      this.startDatePicker = new Litepicker({
        element: this.startDateRef,
        minDate: Date.now(),
        autoRefresh: true,
      });
      this.startDatePicker.on("selected", (date: Date) => {
        this.startDate = date;
        this.startDateUi = new Date(date.toDateString()).toLocaleDateString().replace(/\//g, "-");
      });
    }
    if (!this.endDatePicker) {
      this.endDatePicker = new Litepicker({
        element: this.endDateRef,
        minDate: Date.now(),
        autoRefresh: true,
      });
      this.endDatePicker.on("selected", (date: Date) => {
        this.endDate = date;
        this.endDateUi = new Date(date.toDateString()).toLocaleDateString().replace(/\//g, "-");
      });
    }
  }

  proceed(): void {
    const message: string = this.validateInputs();
    if (message) {
      this.validationError(message);
      this.stageState[this.stageNumber].verified = false;
    } else {
      // Set the ISO time
      // Get the start and end time
      const startTimes = this.startTime.split(":");
      const endTimes = this.endTime.split(":");
      let temp = new Date(this.startDate.toDateString());
      temp.setHours(Number.parseInt(startTimes[0]), Number.parseInt(startTimes[1]));
      this.seedConfig.seedDetails.startDate = this.dateService.toISOString(temp);
      temp = new Date(this.endDate.toDateString());
      temp.setHours(Number.parseInt(endTimes[0]), Number.parseInt(endTimes[1]));
      this.seedConfig.seedDetails.endDate = this.dateService.toISOString(temp);
      this.stageState[this.stageNumber].verified = true;
      this.next();
    }
  }

  detached(): void {
    const message = this.validateInputs();
    if (message) {
      this.stageState[this.stageNumber].verified = false;
    }
  }

  validateInputs(): string {
    let message: string;
    if (!this.seedConfig.seedDetails.seedTokens || this.seedConfig.seedDetails.seedTokens === "0") {
      message = "Please enter a value for the Amount of tokens to be added to SEED";
    } else if (!this.seedConfig.seedDetails.pricePerToken || this.seedConfig.seedDetails.pricePerToken === "0") {
      message = "Please enter a value for the Price per token";
    } else if (!this.seedConfig.seedDetails.seedTarget || this.seedConfig.seedDetails.seedTarget === "0") {
      message = "Please enter a non-zero value for the SEED Target";
    } else if (!this.seedConfig.seedDetails.seedMax || this.seedConfig.seedDetails.seedMax === "0") {
      message = "Please enter a non-zero number for the SEED Max";
    } else if (!this.seedConfig.seedDetails.vestingDays || this.seedConfig.seedDetails.vestingDays <= 0) {
      message = "Please enter a non-zero value for  \"Tokens vested for\" ";
    } else if (!this.seedConfig.seedDetails.vestingCliff || this.seedConfig.seedDetails.vestingCliff <= 0) {
      message = "Please enter a non-zero value for \"with a cliff of\" ";
    } else if (!this.startDate) {
      message = "Please select a Start Date";
    } else if (!this.startTime) {
      message = "Please enter a value for the Start Time";
    } else if (!(Number.parseInt(this.startTime.split(":")[0]) < 25)
      || !(Number.parseInt(this.startTime.split(":")[1]) < 61)) {
      message = "Please enter a valid value for Start Time";
    } else if (!this.endDate) {
      message = "Please select an End Date";
    } else if (!this.endTime) {
      message = "Please enter a value for the End Time";
    } else if (!(Number.parseInt(this.endTime.split(":")[0]) < 25)
      || !(Number.parseInt(this.endTime.split(":")[1]) < 61)) {
      message = "Please enter a valid value for End Time";
    } else if (this.seedConfig.seedDetails.whitelist.isWhitelist && !this.seedConfig.seedDetails.whitelist.whitelistFile) {
      message = "Please upload a .csv file or uncheck Whitelist";
    } else if (!this.seedConfig.seedDetails.legalDisclaimer) {
      message = "Please accept the Legal Disclaimer";
    }
    return message;
  }
}
