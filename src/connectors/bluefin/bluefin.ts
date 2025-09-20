import { OnChainCalls, QueryChain } from '@firefly-exchange/library-sui/spot';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

import { BluefinConfig, bluefin_spot_contracts_mainnet, bluefin_spot_contracts_testnet } from './bluefin.config';

export class Bluefin {
  private static instances: Record<string, Bluefin> = {};
  private _sui: SuiClient;
  private _query: QueryChain;
  private _network: string;

  private constructor(network: string) {
    const suiConfig = BluefinConfig.getSuiConfig(network);
    this._sui = new SuiClient({ url: suiConfig.rpcURL });
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

  public onChain(keypair?: Ed25519Keypair): OnChainCalls {
    const config = this._network === 'mainnet' ? bluefin_spot_contracts_mainnet : bluefin_spot_contracts_testnet;
    const signerOption = keypair ? { signer: keypair } : undefined;
    return new OnChainCalls(this._sui, config, signerOption);
  }
}
