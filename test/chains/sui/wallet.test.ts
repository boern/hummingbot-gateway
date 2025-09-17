import { mockConfigManagerV2 } from '../../mocks/shared-mocks';
jest.mock('../../../src/services/config-manager-v2', () => ({ ConfigManagerV2: mockConfigManagerV2 }));

// Mock fs-extra to prevent actual file writes
jest.mock('fs-extra');

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import * as fse from 'fs-extra';

import { gatewayApp } from '../../../src/app';
import { Sui } from '../../../src/chains/sui/sui';
import { ConfigManagerCertPassphrase } from '../../../src/services/config-manager-cert-passphrase';
import { getInitializedChain, getSupportedChains } from '../../../src/services/connection-manager';
import { GetWalletResponse } from '../../../src/wallet/schemas';
import { validateChainName } from '../../../src/wallet/utils';
import { patch, unpatch } from '../../services/patch';

jest.mock('../../../src/services/connection-manager');
jest.mock('../../../src/wallet/utils');

const mockFse = fse as jest.Mocked<typeof fse>;

let sui: Sui;

// Generate test keypair
const testKeypair = Ed25519Keypair.generate();
const testAddress = testKeypair.getPublicKey().toSuiAddress();
const testPrivateKey = Buffer.from(testKeypair.getSecretKey()).toString('base64');

// Mock the encoded private key response
const encodedPrivateKey = {
  address: testAddress.toLowerCase(),
  id: 'test-id-12345',
  version: 3,
  Crypto: {
    cipher: 'aes-128-ctr',
    cipherparams: { iv: 'test-iv-12345' },
    ciphertext: 'mock-encrypted-key', // noqa: mock
    kdf: 'scrypt',
    kdfparams: {
      salt: 'mock-salt', // noqa: mock
      n: 131072,
      dklen: 32,
      p: 1,
      r: 8,
    },
    mac: 'mock-mac', // noqa: mock
  },
};

// Track wallet operations in memory to avoid file system pollution
const mockWallets: { [key: string]: Set<string> } = {
  sui: new Set<string>(),
};

beforeAll(async () => {
  patch(ConfigManagerCertPassphrase, 'readPassphrase', () => 'a');
  sui = await Sui.getInstance('mainnet');
  await gatewayApp.ready();
});

beforeEach(() => {
  patch(ConfigManagerCertPassphrase, 'readPassphrase', () => 'a');

  // Clear mock wallets
  mockWallets.sui.clear();

  // Mock wallet operations to work with in-memory storage
  patch(sui, 'getKeypairFromPrivateKey', () => {
    return testKeypair;
  });

  patch(sui, 'encrypt', () => {
    return JSON.stringify(encodedPrivateKey);
  });

  patch(Sui, 'validateAddress', (address: string) => address);
  (validateChainName as jest.Mock).mockReturnValue(true);

  (getInitializedChain as jest.Mock).mockResolvedValue(sui);
  (getSupportedChains as jest.Mock).mockReturnValue(['ethereum', 'solana', 'sui']);

  // Setup fs-extra mocks
  (mockFse.writeFile as jest.Mock).mockImplementation(async (path: any) => {
    const pathStr = path.toString();
    const pathParts = pathStr.split('/');
    const chain = pathParts[pathParts.length - 2];
    const address = pathParts[pathParts.length - 1].replace('.json', '');

    if (chain && address) {
      mockWallets[chain].add(address);
    }
    return undefined;
  });

  (mockFse.readdir as jest.Mock).mockImplementation(async (dirPath: any, options?: any) => {
    const pathStr = dirPath.toString();

    // If asking for directories in wallet path
    if (pathStr.endsWith('/wallets') && options?.withFileTypes) {
      return Object.keys(mockWallets).map((chain) => ({
        name: chain,
        isDirectory: () => true,
        isFile: () => false,
      }));
    }

    // If asking for files in a chain directory
    const chain = pathStr.split('/').pop();
    if (chain && mockWallets[chain]) {
      if (options?.withFileTypes) {
        return Array.from(mockWallets[chain]).map((addr) => ({
          name: `${addr}.json`,
          isDirectory: () => false,
          isFile: () => true,
        }));
      }
      return Array.from(mockWallets[chain]).map((addr) => `${addr}.json`);
    }

    return [];
  });

  (mockFse.readFile as jest.Mock).mockResolvedValue(Buffer.from(JSON.stringify(encodedPrivateKey)));
  (mockFse.pathExists as jest.Mock).mockResolvedValue(true);
  (mockFse.ensureDir as jest.Mock).mockResolvedValue(undefined);

  (mockFse.remove as jest.Mock).mockImplementation(async (filePath: any) => {
    const pathStr = filePath.toString();
    const pathParts = pathStr.split('/');
    const chain = pathParts[pathParts.length - 2];
    const address = pathParts[pathParts.length - 1].replace('.json', '');

    if (chain && mockWallets[chain]) {
      mockWallets[chain].delete(address);
    }
    return undefined;
  });
});

afterAll(async () => {
  await gatewayApp.close();
});

afterEach(() => {
  unpatch();
  jest.clearAllMocks();
});

describe('Sui Wallet Operations', () => {
  describe('POST /wallet/add', () => {
    it('should add a Sui wallet successfully', async () => {
      const response = await gatewayApp.inject({
        method: 'POST',
        url: '/wallet/add',
        payload: {
          privateKey: testPrivateKey,
          chain: 'sui',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);

      const result = JSON.parse(response.payload);
      expect(result).toMatchObject({
        address: testAddress,
      });
    });
  });

  describe('GET /wallet', () => {
    it('should fetch wallets for Sui', async () => {
      // First add a wallet
      mockWallets.sui.add(testAddress);

      const response = await gatewayApp.inject({
        method: 'GET',
        url: '/wallet',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);

      const wallets: GetWalletResponse[] = JSON.parse(response.payload);
      const suiWallet = wallets.find((w) => w.chain === 'sui');

      expect(suiWallet).toBeDefined();
      expect(suiWallet?.walletAddresses).toContain(testAddress);
    });
  });

  describe('DELETE /wallet/remove', () => {
    it('should remove a Sui wallet successfully', async () => {
      // First add the wallet to mock storage
      mockWallets.sui.add(testAddress);

      const response = await gatewayApp.inject({
        method: 'DELETE',
        url: '/wallet/remove',
        payload: {
          address: testAddress,
          chain: 'sui',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);

      const body = JSON.parse(response.payload);
      expect(body.message).toContain('removed successfully');
      expect(mockWallets.sui.has(testAddress)).toBe(false);
    });
  });
});
