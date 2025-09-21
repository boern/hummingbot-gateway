import { FastifyInstance } from 'fastify';

import { gatewayApp } from '../../../../src/app';
import { Bluefin } from '../../../../src/connectors/bluefin/bluefin';
import clmmPositionsOwned from '../mocks/bluefin-clmm-pool-positionOwned.json';
import expectedPositionsOwned from '../mocks/bluefin-clmm-positions-owned-wal-usdc.json';

let app: FastifyInstance;
beforeAll(async () => {
  app = await gatewayApp;
  await app.ready();
});

afterAll(() => {
  app.close();
});

describe('GET /connectors/bluefin/clmm/positions-owned', () => {
  const poolAddress = '0xbcc6909d2e85c06cf9cbfe5b292da36f5bfa0f314806474bbf6a0bf9744d37ce';
  const walletAddress = '0xaf9306cac62396be300b175046140c392eed876bd8ac0efac6301cea286fa272';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // Mock the Bluefin.getInstance method to return our mock instance
    jest.spyOn(Bluefin, 'getInstance').mockReturnValue(mockBluefin as any);
  });

  it('should return owned positions for a given wallet and pool', async () => {
    // Arrange: Setup mock responses from the Bluefin SDK
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockSdkPool: any = require('../mocks/bluefin-clmm-pool-info.json');

    mockBluefin.query.getUserPositions.mockResolvedValue(clmmPositionsOwned);
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

    expect(responseBody).toEqual(expectedPositionsOwned);
    expect(mockBluefin.query.getUserPositions).toHaveBeenCalledWith(expect.any(String), walletAddress);
    expect(mockBluefin.query.getPool).toHaveBeenCalledWith(poolAddress);
  });
});
