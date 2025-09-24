import * as crypto from 'crypto';

import { CoinBalance, SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64, isValidSuiAddress } from '@mysten/sui/utils';
import { TokenInfo } from '@solana/spl-token-registry';
import fse from 'fs-extra';

import { ConfigManagerCertPassphrase } from '../../services/config-manager-cert-passphrase';
import { logger } from '../../services/logger';
import { TokenService } from '../../services/token-service';
import { getSafeWalletFilePath, isHardwareWallet as isHardwareWalletUtil } from '../../wallet/utils';

import { SuiNetworkConfig, getSuiNetworkConfig } from './sui.config';

export class Sui {
  private static instances: Record<string, Sui> = {};
  private _client: SuiClient;
  private _nativeToken: string;
  private _chain: string;
  private _network: string;
  public config: SuiNetworkConfig;
  public rpcUrl: string;
  public tokenList: TokenInfo[] = [];
  private _tokenMap: Record<string, TokenInfo> = {};
  // SUI_MAINNET: u8 = 0;
  // SUI_TESTNET: u8 = 1;
  // SUI_CUSTOM: u8 = 2;
  private static readonly SUI_CHAIN_ID = 0;

  private constructor(network: string) {
    this._chain = 'sui';
    this._network = network;
    this.config = getSuiNetworkConfig(network);
    this._client = new SuiClient({ url: this.config.rpcURL });
    this.rpcUrl = this.config.rpcURL;
    this._nativeToken = this.config.nativeCurrency;
  }

  public static async getInstance(network: string): Promise<Sui> {
    if (!Sui.instances[network]) {
      const instance = new Sui(network);
      await instance.init();
      Sui.instances[network] = instance;
    }
    return Sui.instances[network];
  }

  private async init(): Promise<void> {
    try {
      logger.info(`Initializing Sui connector for network: ${this.network}, nodeURL: ${this.config.rpcURL}`);
      await this.loadTokens();
    } catch (e) {
      logger.error(`Failed to initialize ${this.network}: ${e}`);
      throw e;
    }
  }

  async loadTokens(): Promise<void> {
    try {
      // Use TokenService to load tokens
      const tokens = await TokenService.getInstance().loadTokenList('sui', this.network);

      // Convert to TokenInfo format (SPL token registry format)
      this.tokenList = tokens.map((token) => ({
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        chainId: Sui.SUI_CHAIN_ID, // Sui does not have a chainId in the same way as EVM
      }));

      // Create symbol -> token mapping
      this.tokenList.forEach((token: TokenInfo) => {
        this._tokenMap[token.symbol] = token;
      });

      logger.info(`Loaded ${this.tokenList.length} tokens for sui/${this.network}`);
    } catch (error) {
      logger.error(`Failed to load token list for ${this.network}: ${error.message}`);
      throw error;
    }
  }

  async getToken(addressOrSymbol: string): Promise<TokenInfo | null> {
    // First try to find by symbol (case-insensitive)
    const normalizedSearch = addressOrSymbol.toUpperCase().trim();
    let token = this.tokenList.find((token: TokenInfo) => token.symbol.toUpperCase().trim() === normalizedSearch);

    // If not found by symbol, try to find by address
    if (!token) {
      token = this.tokenList.find((token: TokenInfo) => token.address.toLowerCase() === addressOrSymbol.toLowerCase());
    }

    if (!token) throw new Error(`Token ${addressOrSymbol} not found`);

    return token;
  }

  public get client(): SuiClient {
    return this._client;
  }

  public get nativeTokenSymbol(): string {
    return this._nativeToken;
  }

  public get chain(): string {
    return this._chain;
  }

  public get network(): string {
    return this._network;
  }

  async getCurrentBlockNumber(): Promise<number> {
    logger.debug(`Querying for latest checkpoint sequence number on ${this.chain} ${this.network}.`);
    const sequenceNumber = await this.client.getLatestCheckpointSequenceNumber();
    logger.debug(`Latest checkpoint sequence number on ${this.chain} ${this.network}: ${sequenceNumber}.`);
    return parseInt(sequenceNumber, 10);
  }

  async getReferenceGasPrice(): Promise<bigint> {
    logger.debug(`Querying for reference gas price on ${this.chain} ${this.network}.`);
    const gasPrice = await this.client.getReferenceGasPrice();
    logger.debug(`Reference gas price on ${this.chain} ${this.network}: ${gasPrice}.`);
    return gasPrice;
  }

  public async getBalances(
    address: string,
    tokens?: string[],
    fetchAll: boolean = false,
  ): Promise<Record<string, number>> {
    const balances: Record<string, number> = {};
    const allBalances = await this.client.getAllBalances({ owner: address });

    const effectiveSymbols = tokens && tokens.length === 0 ? undefined : tokens;

    // Handle native SUI balance
    const suiBalance = allBalances.find((b) => b.coinType === '0x2::sui::SUI');
    if (!effectiveSymbols || effectiveSymbols.some((s) => s.toUpperCase() === 'SUI')) {
      balances['SUI'] = parseInt(suiBalance?.totalBalance || '0') / Math.pow(10, 9); // SUI has 9 decimals
    }

    if (effectiveSymbols && effectiveSymbols.length === 1 && effectiveSymbols[0].toUpperCase() === 'SUI') {
      return balances;
    }

    if (effectiveSymbols) {
      for (const symbol of effectiveSymbols) {
        if (symbol.toUpperCase() === 'SUI') continue;

        const tokenInfo = await this.getToken(symbol);
        if (tokenInfo) {
          const balance = allBalances.find((b) => b.coinType === tokenInfo.address);
          balances[symbol] = parseInt(balance?.totalBalance || '0') / Math.pow(10, tokenInfo.decimals);
        } else {
          // If it looks like a coinType, use it directly
          if (symbol.includes('::')) {
            const balance = allBalances.find((b) => b.coinType === symbol);
            const tokenInfoFromList = this.tokenList.find((t) => t.address === symbol);
            balances[symbol] = parseInt(balance?.totalBalance || '0') / Math.pow(10, tokenInfoFromList?.decimals || 9); // Assume 9 decimals if not in list
          } else {
            balances[symbol] = 0;
          }
        }
      }
    } else {
      for (const balance of allBalances) {
        const tokenInfo = this.tokenList.find((t) => t.address === balance.coinType);
        if (tokenInfo) {
          if (balances[tokenInfo.symbol] === undefined) {
            balances[tokenInfo.symbol] = parseInt(balance.totalBalance) / Math.pow(10, tokenInfo.decimals);
          }
        } else if (fetchAll) {
          if (balances[balance.coinType] === undefined) {
            // Assuming 9 decimals for unknown tokens
            balances[balance.coinType] = parseInt(balance.totalBalance) / Math.pow(10, 9);
          }
        }
      }
    }

    if (!effectiveSymbols) {
      const filteredBalances: Record<string, number> = {};
      if ('SUI' in balances) {
        filteredBalances['SUI'] = balances['SUI'];
      }
      for (const [key, value] of Object.entries(balances)) {
        if (key !== 'SUI' && value > 0) {
          filteredBalances[key] = value;
        }
      }
      return filteredBalances;
    }

    return balances;
  }

  async getTransactionBlock(txHash: string): Promise<SuiTransactionBlockResponse> {
    logger.debug(`Fetching transaction block for txHash ${txHash} on ${this.chain} ${this.network}.`);
    const txBlock = await this.client.getTransactionBlock({
      digest: txHash,
      options: {
        showInput: true,
        showEffects: true,
        showEvents: true,
      },
    });
    logger.debug(`Returning transaction block for txHash ${txHash} on ${this.chain} ${this.network}.`);
    return txBlock;
  }

  getTransactionStatusCode(txData: SuiTransactionBlockResponse): number {
    if (txData.effects?.status.status === 'success') {
      return 1; // CONFIRMED
    } else if (txData.effects?.status.status === 'failure') {
      return -1; // FAILED
    }
    return 0; // PENDING
  }

  getFee(txData: SuiTransactionBlockResponse): number {
    if (txData.effects) {
      const gasUsed = txData.effects.gasUsed;
      const fee = parseInt(gasUsed.computationCost) + parseInt(gasUsed.storageCost) - parseInt(gasUsed.storageRebate);
      return fee / 1e9; // convert from MIST to SUI
    }
    return 0;
  }

  getKeypairFromPrivateKey(privateKey: string): Ed25519Keypair {
    logger.debug('Getting keypair from private key.');
    // The private key can be in two formats:
    // 1. A Bech32 encoded string with the prefix `suiprivkey`.
    // 2. A Base64 encoded 32-byte secret key.
    if (privateKey.startsWith('suiprivkey')) {
      return Ed25519Keypair.fromSecretKey(privateKey, { skipValidation: true });
    }
    return Ed25519Keypair.fromSecretKey(fromBase64(privateKey), { skipValidation: true });
  }

  static validateAddress(address: string): string {
    logger.debug(`Validating Sui address: ${address}.`);
    if (isValidSuiAddress(address)) {
      logger.debug(`Sui address ${address} is valid.`);
      return address;
    }
    logger.error(`Invalid Sui address: ${address}.`);
    throw new Error('Invalid Sui address');
  }

  async getWallet(address: string): Promise<Ed25519Keypair> {
    try {
      // Validate the address format first
      const validatedAddress = Sui.validateAddress(address);

      // Use the safe wallet file path utility to prevent path injection
      const safeWalletPath = getSafeWalletFilePath('sui', validatedAddress);

      // Read the wallet file using the safe path
      const encryptedPrivateKey: string = await fse.readFile(safeWalletPath, 'utf8');

      const passphrase = ConfigManagerCertPassphrase.readPassphrase();
      if (!passphrase) {
        throw new Error('missing passphrase');
      }
      const decrypted = await this.decrypt(encryptedPrivateKey, passphrase);

      return Ed25519Keypair.fromSecretKey(decrypted);
    } catch (error) {
      if (error.message.includes('Invalid Sui address')) {
        throw error; // Re-throw validation errors
      }
      if (error.code === 'ENOENT') {
        throw new Error(`Wallet not found for address: ${address}`);
      }
      throw error;
    }
  }

  async encrypt(secret: string, password: string): Promise<string> {
    logger.debug('Encrypting secret.');
    const algorithm = 'aes-256-ctr';
    const iv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(32);
    const key = crypto.pbkdf2Sync(password, new Uint8Array(salt), 5000, 32, 'sha512');
    const cipher = crypto.createCipheriv(algorithm, new Uint8Array(key), new Uint8Array(iv));

    const encryptedBuffers = [
      new Uint8Array(cipher.update(new Uint8Array(Buffer.from(secret)))),
      new Uint8Array(cipher.final()),
    ];
    const encrypted = Buffer.concat(encryptedBuffers);

    const ivJSON = iv.toJSON();
    const saltJSON = salt.toJSON();
    const encryptedJSON = encrypted.toJSON();

    logger.debug('Secret encrypted successfully.');
    return JSON.stringify({
      algorithm,
      iv: ivJSON,
      salt: saltJSON,
      encrypted: encryptedJSON,
    });
  }

  async decrypt(encryptedSecret: string, password: string): Promise<string> {
    logger.debug('Decrypting secret.');
    const hash = JSON.parse(encryptedSecret);
    const salt = new Uint8Array(Buffer.from(hash.salt, 'utf8'));
    const iv = new Uint8Array(Buffer.from(hash.iv, 'utf8'));

    const key = crypto.pbkdf2Sync(password, salt, 5000, 32, 'sha512');

    const decipher = crypto.createDecipheriv(hash.algorithm, new Uint8Array(key), iv);

    const decryptedBuffers = [
      new Uint8Array(decipher.update(new Uint8Array(Buffer.from(hash.encrypted, 'hex')))),
      new Uint8Array(decipher.final()),
    ];
    const decrypted = Buffer.concat(decryptedBuffers);

    logger.debug('Secret decrypted successfully.');
    return decrypted.toString();
  }
}
