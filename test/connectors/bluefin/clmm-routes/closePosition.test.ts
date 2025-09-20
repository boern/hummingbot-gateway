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

describe('POST /connectors/bluefin/clmm/close-position', () => {
  const mockBluefin = {
    onChain: jest.fn().mockReturnValue({
      queryChain: {
        getPool: jest.fn(),
      },
      getAccruedFeeAndRewards: jest.fn(),
      closePosition: jest.fn(),
    }),
    query: {
      getPositionDetails: jest.fn(),
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

  it('should close a position and return confirmed data', async () => {
    // Arrange
    const positionAddress = '0x90b36ba02b29bd2b17a5a92c7d284c1c65dd1c85983819d7cc9bf3668ba2894a';
    const walletAddress = '0xaf9306cac62396be300b175046140c392eed876bd8ac0efac6301cea286fa272';

    const mockPositionDetails: any = require('../mocks/bluefin-clmm-positionDetails.json');
    const mockSdkPool: any = require('../mocks/bluefin-clmm-pool-info.json');
    const mockAccruedFees: any = require('../mocks/bluefin-clmm-getAccruedFeeAndRewards.json');
    const mockTxResponse: SuiTransactionBlockResponse = require('../mocks/bluefin-clmm-closePosition.json');

    mockBluefin.query.getPositionDetails.mockResolvedValue(mockPositionDetails);
    mockBluefin.onChain().queryChain.getPool.mockResolvedValue(mockSdkPool);
    mockBluefin.onChain().getAccruedFeeAndRewards.mockResolvedValue(mockAccruedFees);
    mockBluefin.onChain().closePosition.mockResolvedValue(mockTxResponse);
    mockSui.getTransactionBlock.mockResolvedValue(mockTxResponse as any);

    console.log('Mock Position Details:', JSON.stringify(mockPositionDetails, null, 2));
    console.log('Mock SDK Pool:', JSON.stringify(mockSdkPool, null, 2));
    console.log('Mock Accrued Fees:', JSON.stringify(mockAccruedFees, null, 2));
    console.log('Mock TX Response:', JSON.stringify(mockTxResponse, null, 2));

    // Act
    const requestBody = {
      network: 'mainnet',
      walletAddress: walletAddress,
      positionAddress: positionAddress,
    };
    console.log('Request Body for /close-position:', JSON.stringify(requestBody, null, 2));

    const response = await app.inject({
      method: 'POST',
      url: '/connectors/bluefin/clmm/close-position',
      body: requestBody,
    });

    // Assert
    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body);
    console.log('Actual Response Body from /close-position:', JSON.stringify(responseBody, null, 2));

    expect(responseBody).toEqual({
      signature: '8Er928dxJSGCyJENnmfFPfdgpBntRxxcpLGLDJ6BcALh',
      status: 1,
      data: {
        fee: 0.001061484,
        positionRentRefunded: 0.027154116,
        baseTokenAmountRemoved: 339.268214815,
        quoteTokenAmountRemoved: 37.960895,
        baseFeeAmountCollected: 3.143559549,
        quoteFeeAmountCollected: 1.433628,
      },
    });

    // Verify mocks were called correctly
    expect(mockBluefin.onChain().closePosition).toHaveBeenCalledWith(mockSdkPool, positionAddress);
    expect(mockSui.getTransactionBlock).toHaveBeenCalledWith(mockTxResponse.digest);
  });
});
