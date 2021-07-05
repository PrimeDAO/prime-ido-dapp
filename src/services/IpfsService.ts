import { autoinject } from "aurelia-framework";
import { Hash } from "services/EthereumService";
import axios from "axios";
import { ConsoleLogService } from "services/ConsoleLogService";
const CID = require("cids");

export interface IIpfsClient {
  pinHash(hash: Hash, name?: string): Promise<void>;
  addAndPinData(data: string, name?: string): Promise<Hash>;
}

export interface IAlchemyProposalParams {
  title: string;
  url ?: string;
  description: string;
  tags ?: string[];
}

@autoinject
export class IpfsService {

  constructor(private consoleLogService: ConsoleLogService) {}

  /**
   * must be initialize externally prior to using the service
   */
  private ipfs: IIpfsClient;

  public initialize(ipfs: IIpfsClient): void {
    this.ipfs = ipfs;
  }

  /**
 * save data of an Alchemy proposal to IPFS, return the IPFS hash
 * @param  options an Object to save. This object must have title, url and description defined
 * @return  a Promise that resolves in the IPFS Hash where the file is saved
 */
  public saveAlchemyProposalDescription(options: IAlchemyProposalParams): Promise<Hash> {
    let ipfsDataToSave = {};
    if (options.title || options.url || options.description || options.tags !== undefined) {
      ipfsDataToSave = {
        description: options.description,
        tags: options.tags,
        title: options.title,
        url: options.url,
      };
    }
    return this.ipfs.addAndPinData(JSON.stringify(ipfsDataToSave));
  }

  /**
   * fetches JSON data given hash, converts to an object
   * @param hash
   * @returns
   */
  public async getObjectFromHash(hash: Hash) : Promise<any> {
    try {
      const response = await axios.get(this.getIpfsUrl(hash));

      if (response.status !== 200) {
        throw Error(`An error occurred getting the hash ${hash}: ${response.statusText}`);
      } else {
        return JSON.parse(response.data);
      }
    } catch (ex) {
      this.consoleLogService.logMessage(ex.message, "warning");
      return null;
    }
  }

  /**
   * saves and pin the given data
   * @param str
   * @returns the resulting hash
   */
  public async saveString(str: string, name?: string): Promise<Hash> {
    return this.ipfs.addAndPinData(str, name);
  }

  /**
   * url to use to request content from IPFS
   * @param hash
   * @returns
   */
  public getIpfsUrl(hash: string): string {
    const format = process.env.IPFS_GATEWAY;
    const encodedHash = new CID(hash).toV1().toBaseEncodedString("base32");
    return format.replace("${hash}", encodedHash);
  }
}
