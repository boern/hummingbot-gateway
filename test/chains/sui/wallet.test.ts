// Mock fs-extra to prevent actual file writes
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import * as fse from 'fs-extra';

import { gatewayApp } from '../../../src/app';
import { Sui } from '../../../src/chains/sui/sui';
import { getSuiChainConfig } from '../../../src/chains/sui/sui.config';
import { ConfigManagerCertPassphrase } from '../../../src/services/config-manager-cert-passphrase';
import { GetWalletResponse } from '../../../src/wallet/schemas';
import { mockConfigManagerV2, mockConfigNamespace } from '../../mocks/shared-mocks';
import { patch, unpatch } from '../../services/patch';

jest.mock('fs-extra');
// Mock ConfigManagerV2 to control its behavior in tests
jest.mock('../../../src/services/config-manager-v2', () => {
  // Import the mock object and then return it in the factory
  const { mockConfigManagerV2 } = require('../../mocks/shared-mocks');
  return {
    ConfigManagerV2: { getInstance: jest.fn().mockReturnValue(mockConfigManagerV2) },
  };
});

const mockFse = fse as jest.Mocked<typeof fse>;

let sui: Sui;

const testKeypair = Ed25519Keypair.generate();
const testAddress = testKeypair.getPublicKey().toSuiAddress();
const testPrivateKey = Buffer.from(testKeypair.getSecretKey()).toString('base64');

// Mock the encoded private key response
const encodedPrivateKey = {
  address: testAddress.toLowerCase(),
  id: 'test-id-sui-12345',
  version: 3,
  Crypto: {
    cipher: 'aes-128-ctr',
    cipherparams: { iv: 'test-iv-sui-12345' },
    ciphertext: 'mock-encrypted-key-sui', // noqa: mock
    kdf: 'scrypt',
    kdfparams: {
      salt: 'mock-salt-sui', // noqa: mock
      n: 131072,
      dklen: 32,
      p: 1,
      r: 8,
    },
    mac: 'mock-mac-sui', // noqa: mock
  },
};

// Track wallet operations in memory to avoid file system pollution
const mockWallets: { [key: string]: Set<string> } = {
  sui: new Set<string>(),
};

const suiChainConfig = getSuiChainConfig();

beforeAll(async () => {
  patch(ConfigManagerCertPassphrase, 'readPassphrase', () => 'a');
  // Initialize the app after all mocks are set up
  sui = await Sui.getInstance(suiChainConfig.defaultNetwork);
  await gatewayApp.ready();
});

beforeEach(() => {
  // Reset mocks before each test to ensure isolation
  jest.clearAllMocks();

  // The mock is now handled by jest.mock at the top of the file

  // Reset specific mock implementations
  (mockConfigManagerV2.get as jest.Mock).mockReturnValue({ sui: {} });
  (mockConfigManagerV2.getNamespace as jest.Mock).mockReset();
  (mockConfigManagerV2.set as jest.Mock).mockReset();
  (mockConfigNamespace.set as jest.Mock).mockClear();

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

  // Setup fs-extra mocks
  (mockFse.writeFile as jest.Mock).mockImplementation(async (path: any) => {
    const pathStr = path.toString();
    const pathParts = pathStr.split('/');
    const chain = pathParts[pathParts.length - 2];
    const address = pathParts[pathParts.length - 1].replace('.json', '');

    if (chain && address && mockWallets[chain]) {
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

  describe('POST /wallet/setDefault', () => {
    it('should set a default Sui wallet successfully', async () => {
      // Mock the necessary ConfigManagerV2 methods for this test
      (mockConfigManagerV2.unpackFullConfigPath as jest.Mock).mockReturnValue({
        namespace: mockConfigNamespace,
        configPath: 'defaultWallet',
      });

      // First add the wallet to mock storage
      mockWallets.sui.add(testAddress);
      // Ensure that the file system mock reports that the wallet file exists.
      (mockFse.pathExists as jest.Mock).mockResolvedValue(true);

      const response = await gatewayApp.inject({
        method: 'POST',
        url: '/wallet/setDefault',
        payload: {
          chain: 'sui',
          address: testAddress,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);

      const body = JSON.parse(response.payload);
      expect(body.message).toContain('Successfully set default wallet');

      // Verify that the config manager's set method was called correctly
      expect(mockConfigManagerV2.set).toHaveBeenCalledWith('sui.defaultWallet', testAddress);
    });
  });
});
