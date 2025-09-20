import fs from 'fs';

import { Pool } from '../../../src/pools/types';
import { PoolService } from '../../../src/services/pool-service';

jest.mock('fs');
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn(),
}));
jest.mock('../../../src/services/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('PoolService for Bluefin', () => {
  let poolService: PoolService;

  beforeEach(() => {
    poolService = PoolService.getInstance();
    jest.clearAllMocks();
  });

  describe('validatePool', () => {
    it('should not throw for a valid Bluefin pool structure', async () => {
      const pool: Pool = {
        type: 'clmm',
        baseSymbol: 'SUI',
        quoteSymbol: 'USDC',
        network: 'mainnet',
        address: '0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa',
      };

      // With Bluefin support added, this should resolve without throwing an error.
      await expect(poolService.validatePool('bluefin', pool)).resolves.not.toThrow();
    });

    it('should reject for an invalid Bluefin pool address', async () => {
      const pool: Pool = {
        type: 'clmm',
        baseSymbol: 'SUI',
        quoteSymbol: 'USDC',
        network: 'mainnet',
        address: 'invalid-sui-address',
      };

      await expect(poolService.validatePool('bluefin', pool)).rejects.toThrow('Invalid Sui pool address');
    });
  });
});
