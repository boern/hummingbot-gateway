import { SuiTransactionBlockResponse } from '@mysten/sui/client';
import { FastifyInstance } from 'fastify';

import { gatewayApp } from '../../../../src/app';
import { Sui } from '../../../../src/chains/sui/sui';
import { Bluefin } from '../../../../src/connectors/bluefin/bluefin';

let app: FastifyInstance;
beforeAll(async () => {
  app = await gatewayApp;
  await app.ready();
});
afterAll(() => {
  app.close();
});

describe('POST /connectors/bluefin/clmm/remove-liquidity', () => {
  const mockBluefin = {
    onChain: jest.fn().mockReturnValue({
      removeLiquidity: jest.fn(),
    }),
    query: {
      getPositionDetails: jest.fn(),
      getPool: jest.fn(),
    },
  };

  const mockSui = {
    getWallet: jest.fn(),
    getTransactionBlock: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Bluefin, 'getInstance').mockReturnValue(mockBluefin as any);
    jest.spyOn(Sui, 'getInstance').mockResolvedValue(mockSui as any);
  });

  it('should remove liquidity from a position and return confirmed data', async () => {
    // Arrange
    const positionAddress = '0xd13d312ec4a31b2ef873568bf8115ea4bb381583a226bfb20cbd60ce1abb7844';
    const walletAddress = '0xaf9306cac62396be300b175046140c392eed876bd8ac0efac6301cea286fa272';
    const percentageToRemove = 10;

    const mockPositionDetails: any = require('../mocks/bluefin-clmm-positionDetails.json');
    const mockSdkPool: any = require('../mocks/bluefin-clmm-pool-info.json');
    const mockTxResponse: SuiTransactionBlockResponse = require('../mocks/bluefin-clmm-removeLiquidityWithPercentage.json');

    mockBluefin.query.getPositionDetails.mockResolvedValue(mockPositionDetails);
    mockBluefin.query.getPool.mockResolvedValue(mockSdkPool);
    (mockBluefin.onChain().removeLiquidity as jest.Mock).mockResolvedValue(mockTxResponse);
    mockSui.getTransactionBlock.mockResolvedValue(mockTxResponse as any);

    // Act
    const requestBody = {
      network: 'mainnet',
      walletAddress: walletAddress,
      positionAddress: positionAddress,
      percentageToRemove: percentageToRemove,
    };
    console.log('Request Body for /remove-liquidity:', JSON.stringify(requestBody, null, 2));
    const response = await app.inject({
      method: 'POST',
      url: '/connectors/bluefin/clmm/remove-liquidity',
      body: requestBody,
    });

    // Assert
    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body);
    console.log('Actual Response Body from /remove-liquidity:', JSON.stringify(responseBody, null, 2));

    expect(responseBody.signature).toEqual(mockTxResponse.digest);
    expect(responseBody.status).toBe(1);
    expect(responseBody.data.fee).toBeCloseTo(0.007855884);
    expect(responseBody.data.baseTokenAmountRemoved).toBeCloseTo(477.09075106);
    expect(responseBody.data.quoteTokenAmountRemoved).toBeCloseTo(0);

    // Verify mocks were called correctly
    expect(mockBluefin.onChain().removeLiquidity).toHaveBeenCalled();
    expect(mockSui.getTransactionBlock).toHaveBeenCalledWith(mockTxResponse.digest);
  });
});
