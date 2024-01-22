import axios from "axios";
import { isLocalhostNetwork } from "./EthereumService";

export class GeoBlockService {
  private blacklist = new Set<string>([
    "CU",
    "IR",
    "SY",
    "KP",
    "US",
    "UM",
    "AF",
    "ET",
    "GY",
    "IQ",
    "SD",
    "YE",
    "VE",
  ]);

  public async initialize(): Promise<void> {
    const country = await this.getCountry();
    if (isLocalhostNetwork()) {
      this.blackisted = false;
    } else {
      this.blackisted = country ? this.blacklist.has(country) : true;
    }
  }

  private getCountry(): Promise<string> {
    return axios.get(`https://api.ipstack.com/check?access_key=${process.env.IPSTACK_API_KEY}`)
      .then((response) => {
        return response.data.country_code ?? null;
      })
      .catch((error) => {
        return axios.get(`https://api.ip2location.io`)
          .then((response) => {
            return response.data.country_code ?? null;
          });
      });
  }

  public blackisted: boolean;
}
