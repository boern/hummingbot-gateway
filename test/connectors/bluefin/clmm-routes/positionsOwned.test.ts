import { Pool, IPosition } from '@firefly-exchange/library-sui/spot';
import { BN } from 'bn.js';
import { FastifyInstance } from 'fastify';

import { gatewayApp } from '../../../../src/app';
import { Bluefin } from '../../../../src/connectors/bluefin/bluefin';
import clmmPositionsOwned from '../mocks/clmm-positions-owned.json';

let app: FastifyInstance;
beforeAll(async () => {
  app = await gatewayApp;
  await app.ready();
});

afterAll(() => {
  app.close();
});

describe('GET /connectors/bluefin/clmm/positions-owned', () => {
  const poolAddress = '0xa701a909673dbc597e63b4586ace6643c02ac0e118382a78b9a21262a4a2e35d';
  const walletAddress = '0x1234567890abcdef';

  // Mock the Bluefin SDK calls
  const mockBluefin = {
    query: {
      getUserPositions: jest.fn(),
      getPool: jest.fn(),
    },
  };

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Mock the Bluefin.getInstance method to return our mock instance
    jest.spyOn(Bluefin, 'getInstance').mockReturnValue(mockBluefin as any);
  });

  it('should return owned positions for a given wallet and pool', async () => {
    // Arrange: Setup mock responses from the Bluefin SDK
    const mockSdkPosition: IPosition = {
      owner: walletAddress,
      pool_id: poolAddress,
      position_id: '0x123456789abcdef',
      lower_tick: 79000,
      upper_tick: 81000,
      liquidity: 1000000000,
      fee_growth_coin_a: 81000,
      fee_growth_coin_b: 81000,
      fee_rate: 100,
      token_a_fee: 10000,
      token_b_fee: 18000,
    };

    const mockSdkPool: Partial<Pool> = {
      id: poolAddress,
      coin_a: { address: '0x2::sui::SUI', decimals: 9, balance: '2' },
      coin_b: { address: '0x...usdc::USDC', decimals: 6, balance: '5' },
      current_sqrt_price: '13546363633333333333333333333333', // Approx 1.8 price
      current_tick: 80000,
      ticks_manager: { tick_spacing: 20, bitmap: {}, ticks: {} },
      fee_rate: 1000,
    };

    mockBluefin.query.getUserPositions.mockResolvedValue([mockSdkPosition]);
    mockBluefin.query.getPool.mockResolvedValue(mockSdkPool);

    // Act: Make the API request
    const response = await app.inject({
      method: 'GET',
      url: '/connectors/bluefin/clmm/positions-owned',
      query: {
        network: 'mainnet',
        walletAddress: walletAddress,
        poolAddress: poolAddress,
      },
    });

    // Assert: Check the response
    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body);
    expect(responseBody).toEqual(expect.arrayContaining([expect.objectContaining(clmmPositionsOwned[0])]));
    expect(mockBluefin.query.getUserPositions).toHaveBeenCalledWith(expect.any(String), walletAddress);
    expect(mockBluefin.query.getPool).toHaveBeenCalledWith(poolAddress, 'mainnet');
  });
});
