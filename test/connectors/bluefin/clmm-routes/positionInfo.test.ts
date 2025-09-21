import { FastifyInstance } from 'fastify';

import { gatewayApp } from '../../../../src/app';
import { Bluefin } from '../../../../src/connectors/bluefin/bluefin';
import expectedPositionInfo from '../mocks/bluefin-clmm-positionDetail-wal-usdc.json';
import mockPositionDetails from '../mocks/bluefin-clmm-positionDetails.json';

let app: FastifyInstance;
beforeAll(async () => {
  app = await gatewayApp;
  await app.ready();
});

afterAll(() => {
  app.close();
});

describe('GET /connectors/bluefin/clmm/position-info', () => {
  const positionAddress = '0xd13d312ec4a31b2ef873568bf8115ea4bb381583a226bfb20cbd60ce1abb7844';

  // Mock the Bluefin SDK calls
  const mockBluefin = {
    query: {
      getPositionDetails: jest.fn(),
      getPool: jest.fn(),
    },
  };

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Mock the Bluefin.getInstance method to return our mock instance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(Bluefin, 'getInstance').mockReturnValue(mockBluefin as any);
  });

  it('should return position info for a given position address', async () => {
    // Arrange: Setup mock responses from the Bluefin SDK
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockSdkPool: any = require('../mocks/bluefin-clmm-pool-info.json');

    mockBluefin.query.getPositionDetails.mockResolvedValue(mockPositionDetails);
    mockBluefin.query.getPool.mockResolvedValue(mockSdkPool);

    // Act: Make the API request
    const response = await app.inject({
      method: 'GET',
      url: '/connectors/bluefin/clmm/position-info',
      query: {
        network: 'mainnet',
        positionAddress: positionAddress,
      },
    });

    // Assert: Check the response
    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body);

    // The expected position info is the first (and only) element of the array
    console.log('Actual Response Body:', JSON.stringify(responseBody, null, 2));
    console.log('Expected Position Info:', JSON.stringify(expectedPositionInfo, null, 2));
    expect(responseBody).toEqual(expectedPositionInfo);

    expect(mockBluefin.query.getPositionDetails).toHaveBeenCalledWith(positionAddress);
    expect(mockBluefin.query.getPool).toHaveBeenCalledWith(mockPositionDetails.pool_id);
  });
});
