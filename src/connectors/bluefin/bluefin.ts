import { OnChainCalls, QueryChain } from '@firefly-exchange/library-sui/spot';
import { SuiClient } from '@mysten/sui/client';

import { BluefinConfig, mainnet, testnet } from './bluefin.config';

export class Bluefin {
  private static instances: Record<string, Bluefin> = {};
  private _sui: SuiClient;
  private _query: QueryChain;
  private _onChain: OnChainCalls | null = null;
  private _network: string;

  private constructor(network: string) {
    const suiConfig = BluefinConfig.getSuiConfig(network);
    this._sui = new SuiClient({ url: suiConfig.nodeURL });
    this._query = new QueryChain(this._sui);
    this._network = network;
  }

  public static getInstance(network: string): Bluefin {
    if (!Bluefin.instances[network]) {
      Bluefin.instances[network] = new Bluefin(network);
    }
    return Bluefin.instances[network];
  }

  public get sui(): SuiClient {
    return this._sui;
  }

  public get query(): QueryChain {
    return this._query;
  }

  public get onChain(): OnChainCalls {
    if (!this._onChain) {
      const config = this._network === 'mainnet' ? mainnet : testnet;
      this._onChain = new OnChainCalls(this._sui, config);
    }
    return this._onChain;
  }
}
