import { BN } from 'bn.js';
import { FastifyInstance } from 'fastify';

import { gatewayApp } from '../../../../src/app';
import { Bluefin } from '../../../../src/connectors/bluefin/bluefin';
import expectedPoolInfo from '../mocks/bluefin-clmm-pool-info-wal-usdc.json';

let app: FastifyInstance;
beforeAll(async () => {
  app = await gatewayApp;
  await app.ready();
});

afterAll(() => {
  app.close();
});

describe('Bluefin CLMM poolInfo', () => {
  const poolAddress = '0xbcc6909d2e85c06cf9cbfe5b292da36f5bfa0f314806474bbf6a0bf9744d37ce';

  // Mock the Bluefin SDK
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
    const mockSdkPool: any = require('../mocks/clmm-pool-info.json');
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

    // Log the actual and expected values for debugging
    console.log('Actual Response Body:', JSON.stringify(responseBody, null, 2));
    console.log('Expected Pool Info:', JSON.stringify(expectedPoolInfo, null, 2));

    // Check if the response matches the expected structure and values
    expect(responseBody).toEqual(expect.objectContaining(expectedPoolInfo));

    // Verify that the mocked function was called with the correct parameters
    expect(Bluefin.getInstance).toHaveBeenCalledWith('mainnet');
    expect(mockBluefin.query.getPool).toHaveBeenCalledWith(poolAddress);
  });
});
