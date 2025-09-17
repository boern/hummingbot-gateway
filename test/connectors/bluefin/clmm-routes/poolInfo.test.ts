import { Pool } from '@firefly-exchange/library-sui/spot';
import { FastifyInstance } from 'fastify';

import { gatewayApp } from '../../../../src/app';
import { Bluefin } from '../../../../src/connectors/bluefin/bluefin';

let app: FastifyInstance;
beforeAll(async () => {
  app = await gatewayApp;
  await app.ready();
});

afterAll(() => {
  app.close();
});

describe('Bluefin CLMM poolInfo', () => {
  const poolAddress = '0xa701a909673dbc597e63b4586ace6643c02ac0e118382a78b9a21262a4a2e35d';

  // Mock the Bluefin SDK calls
  const mockBluefin = {
    query: {
      getPool: jest.fn(),
    },
  };

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Mock the Bluefin.getInstance method to return our mock instance
    jest.spyOn(Bluefin, 'getInstance').mockReturnValue(mockBluefin as any);
  });

  it('should return pool information', async () => {
    // Arrange: Setup mock responses from the Bluefin SDK
    const mockSdkPool: Partial<Pool> = {
      id: poolAddress,
      coin_a: { address: '0x2::sui::SUI', decimals: 9, balance: '2' },
      coin_b: { address: '0x...usdc::USDC', decimals: 6, balance: '5' },
      current_sqrt_price: '13546363633333333333333333333333', // Approx 1.8 price
      current_tick: 80000,
      ticks_manager: { tick_spacing: 20, bitmap: {}, ticks: {} },
      fee_rate: 1000,
    };

    mockBluefin.query.getPool.mockResolvedValue(mockSdkPool);

    // Act: Make the API request
    const response = await app.inject({
      method: 'GET',
      url: '/connectors/bluefin/clmm/pool-info',
      query: {
        network: 'mainnet',
        poolAddress: poolAddress,
      },
    });
    // Assert: Check the response
    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body);
    expect(responseBody).toMatchSnapshot({});

    // Ensure the mock was called with the correct parameters
    expect(mockBluefin.query.getPool).toHaveBeenCalledWith(poolAddress);
  });
});
