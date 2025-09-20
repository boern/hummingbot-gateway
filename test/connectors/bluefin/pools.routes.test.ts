import Fastify, { FastifyInstance } from 'fastify';

// Mock dependencies
jest.mock('../../../src/services/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../src/services/pool-service');

// Mock @fastify/sensible
jest.mock('@fastify/sensible', () => {
  const plugin = jest.fn(async (fastify) => {
    fastify.decorate('httpErrors', {
      badRequest: (msg: string) => {
        const error: any = new Error(msg);
        error.statusCode = 400;
        error.name = 'BadRequestError';
        return error;
      },
      notFound: (msg: string) => {
        const error: any = new Error(msg);
        error.statusCode = 404;
        error.name = 'NotFoundError';
        return error;
      },
      internalServerError: (msg: string) => {
        const error: any = new Error(msg);
        error.statusCode = 500;
        error.name = 'InternalServerError';
        return error;
      },
    });
  });

  // Return as default export
  return {
    __esModule: true,
    default: plugin,
  };
});

// Import after mocking
import { poolRoutes } from '../../../src/pools/pools.routes';
import { Pool } from '../../../src/pools/types';
import { PoolService } from '../../../src/services/pool-service';

describe('Pool Routes Tests', () => {
  let fastify: FastifyInstance;
  let mockPoolService: jest.Mocked<PoolService>;

  beforeEach(async () => {
    // Create a new Fastify instance for each test
    fastify = Fastify();

    // Setup PoolService mock
    mockPoolService = {
      listPools: jest.fn(),
      getPool: jest.fn(),
      addPool: jest.fn(),
      removePool: jest.fn(),
      loadPoolList: jest.fn(),
      savePoolList: jest.fn(),
      validatePool: jest.fn(),
      getPoolByAddress: jest.fn(),
      getDefaultPools: jest.fn(),
    } as any;

    (PoolService.getInstance as jest.Mock).mockReturnValue(mockPoolService);

    // Manually add httpErrors to fastify instance since we're mocking sensible
    (fastify as any).httpErrors = {
      badRequest: (msg: string) => {
        const error: any = new Error(msg);
        error.statusCode = 400;
        return error;
      },
      notFound: (msg: string) => {
        const error: any = new Error(msg);
        error.statusCode = 404;
        return error;
      },
      internalServerError: (msg: string) => {
        const error: any = new Error(msg);
        error.statusCode = 500;
        return error;
      },
    };

    // Set a global error handler to properly handle errors from routes
    fastify.setErrorHandler((error, _request, reply) => {
      reply.status(error.statusCode || 500).send({
        message: error.message,
        statusCode: error.statusCode || 500,
      });
    });

    // Register the pool routes plugin
    await fastify.register(poolRoutes);

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('GET /pools with bluefin connector', () => {
    it('should list all pools for a connector', async () => {
      const mockPools: Pool[] = [
        {
          type: 'clmm',
          network: 'mainnet',
          baseSymbol: 'SUI',
          quoteSymbol: 'USDC',
          address: '0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa',
        },
        {
          type: 'clmm',
          network: 'mainnet',
          baseSymbol: 'vSUI',
          quoteSymbol: 'USDC',
          address: '0x081325342b3a8a245c145519479239055d24fa69a19b75b811d4e5111957542f',
        },
      ];

      mockPoolService.listPools.mockResolvedValue(mockPools);

      const response = await fastify.inject({
        method: 'GET',
        url: '/?connector=bluefin&network=mainnet',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockPools);
      expect(mockPoolService.listPools).toHaveBeenCalledWith('bluefin', 'mainnet', undefined, undefined);
    });

    it('should filter pools by type', async () => {
      const mockPools: Pool[] = [
        {
          type: 'clmm',
          network: 'mainnet',
          baseSymbol: 'SUI',
          quoteSymbol: 'USDC',
          address: '0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa',
        },
      ];

      mockPoolService.listPools.mockResolvedValue(mockPools);

      const response = await fastify.inject({
        method: 'GET',
        url: '/?connector=bluefin&network=mainnet&type=clmm',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockPools);
      expect(mockPoolService.listPools).toHaveBeenCalledWith('bluefin', 'mainnet', 'clmm', undefined);
    });

    it('should search pools by token symbol', async () => {
      const mockPools: Pool[] = [
        {
          type: 'clmm',
          network: 'mainnet',
          baseSymbol: 'SUI',
          quoteSymbol: 'USDC',
          address: '0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa',
        },
      ];

      mockPoolService.listPools.mockResolvedValue(mockPools);

      const response = await fastify.inject({
        method: 'GET',
        url: '/?connector=bluefin&search=SUI',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockPools);
      expect(mockPoolService.listPools).toHaveBeenCalledWith('bluefin', undefined, undefined, 'SUI');
    });

    it('should return 400 for invalid parameters', async () => {
      mockPoolService.listPools.mockRejectedValue(new Error('Invalid connector name'));

      const response = await fastify.inject({
        method: 'GET',
        url: '/?connector=invalid&network=mainnet',
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload)).toHaveProperty('message');
    });
  });

  describe('GET /pools/:tradingPair with bluefin connector', () => {
    it('should find pool by trading pair', async () => {
      const mockPool: Pool = {
        type: 'clmm',
        network: 'mainnet',
        baseSymbol: 'SUI',
        quoteSymbol: 'USDC',
        address: '0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa',
      };

      mockPoolService.getPool.mockResolvedValue(mockPool);

      const response = await fastify.inject({
        method: 'GET',
        url: '/SUI-USDC?connector=bluefin&network=mainnet&type=clmm',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockPool);
      expect(mockPoolService.getPool).toHaveBeenCalledWith('bluefin', 'mainnet', 'clmm', 'SUI', 'USDC');
    });

    it('should return 404 if pool not found', async () => {
      mockPoolService.getPool.mockResolvedValue(null);

      const response = await fastify.inject({
        method: 'GET',
        url: '/UNKNOWN-TOKEN?connector=bluefin&network=mainnet&type=clmm',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload)).toHaveProperty('message');
    });

    it('should return 400 for invalid trading pair format', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/INVALIDFORMAT?connector=bluefin&network=mainnet&type=clmm',
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload)).toHaveProperty('message');
      expect(JSON.parse(response.payload).message).toContain(
        'Invalid trading pair format. Expected: BASE-QUOTE (e.g., ETH-USDC)',
      );
    });
  });

  describe('POST /pools', () => {
    it('should add new bluefin pool successfully', async () => {
      mockPoolService.addPool.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: 'POST',
        url: '/',
        payload: {
          connector: 'bluefin',
          type: 'clmm',
          network: 'mainnet',
          baseSymbol: 'SUI',
          quoteSymbol: 'USDC',
          address: '0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveProperty('message');
      expect(JSON.parse(response.payload).message).toContain('Pool SUI-USDC added successfully');

      expect(mockPoolService.addPool).toHaveBeenCalledWith('bluefin', {
        type: 'clmm',
        network: 'mainnet',
        baseSymbol: 'SUI',
        quoteSymbol: 'USDC',
        address: '0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa',
      });
    });

    it('should return 400 for duplicate pool', async () => {
      mockPoolService.addPool.mockRejectedValue(new Error('Pool with address already exists'));

      const response = await fastify.inject({
        method: 'POST',
        url: '/',
        payload: {
          connector: 'bluefin',
          type: 'clmm',
          network: 'mainnet',
          baseSymbol: 'SUI',
          quoteSymbol: 'USDC',
          address: '0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload)).toHaveProperty('message');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/',
        payload: {
          connector: 'bluefin',
          network: 'mainnet',
          // Missing other required fields
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /pools/:address with bluefin connector', () => {
    it('should remove bluefin pool successfully', async () => {
      mockPoolService.removePool.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa?connector=bluefin&network=mainnet&type=clmm',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveProperty('message');
      expect(JSON.parse(response.payload).message).toContain('Pool with address');

      expect(mockPoolService.removePool).toHaveBeenCalledWith(
        'bluefin',
        'mainnet',
        'clmm',
        '0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa',
      );
    });

    it('should return 404 if bluefin pool not found', async () => {
      mockPoolService.removePool.mockRejectedValue(new Error('Pool with address NonExistent not found'));

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/NonExistent?connector=bluefin&network=mainnet&type=clmm',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload)).toHaveProperty('message');
    });

    it('should return 400 for missing required parameters', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa?connector=bluefin',
        // Missing network and type
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
