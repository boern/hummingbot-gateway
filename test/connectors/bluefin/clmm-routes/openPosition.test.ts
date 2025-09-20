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

describe('POST /connectors/bluefin/clmm/open-position', () => {
  const mockBluefin = {
    onChain: jest.fn().mockReturnValue({
      openPositionWithLiquidity: jest.fn(),
    }),
    query: {
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

  it('should open a new position with balanced amounts and return confirmed data', async () => {
    // Arrange
    const poolAddress = '0xbcc6909d2e85c06cf9cbfe5b292da36f5bfa0f314806474bbf6a0bf9744d37ce';
    const walletAddress = '0xaf9306cac62396be300b175046140c392eed876bd8ac0efac6301cea286fa272';
    const lowerPrice = 0.42965113;
    const upperPrice = 0.456229137;
    const baseTokenAmount = 120;
    const quoteTokenAmount = 12.02;

    const mockTxResponse: SuiTransactionBlockResponse = require('../mocks/bluefin-clmm-openPositionWithBalancedAmount.json');
    const mockSdkPool: any = require('../mocks/bluefin-clmm-pool-info.json');

    mockBluefin.query.getPool.mockResolvedValue(mockSdkPool);
    (mockBluefin.onChain().openPositionWithLiquidity as jest.Mock).mockResolvedValue(mockTxResponse);
    mockSui.getTransactionBlock.mockResolvedValue(mockTxResponse as any);

    // Act
    const requestBody = {
      network: 'mainnet',
      walletAddress: walletAddress,
      poolAddress: poolAddress,
      lowerPrice: lowerPrice.toString(),
      upperPrice: upperPrice.toString(),
      baseTokenAmount: baseTokenAmount.toString(),
      quoteTokenAmount: quoteTokenAmount.toString(),
    };
    console.log('Request Body for /open-position:', JSON.stringify(requestBody, null, 2));

    const response = await app.inject({
      method: 'POST',
      url: '/connectors/bluefin/clmm/open-position',
      body: requestBody,
    });

    // Assert
    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body);
    console.log('Actual Response Body from /open-position:', JSON.stringify(responseBody, null, 2));

    expect(responseBody).toEqual({
      signature: 'Wx28LuCdTo67DXjKRBvKPBB6Vvu56uqDUE2wonGVCPb',
      status: 1,
      data: {
        fee: 0.006671804,
        positionAddress: '0x90b36ba02b29bd2b17a5a92c7d284c1c65dd1c85983819d7cc9bf3668ba2894a',
        positionRent: 0.0239476,
        baseTokenAmountAdded: 97.779814437,
        quoteTokenAmountAdded: 12.02,
      },
    });

    // Verify mocks were called correctly
    expect(mockBluefin.onChain().openPositionWithLiquidity).toHaveBeenCalled();
    expect(mockSui.getTransactionBlock).toHaveBeenCalledWith(mockTxResponse.digest);
  });
});
