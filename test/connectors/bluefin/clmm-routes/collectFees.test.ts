import { SuiTransactionBlockResponse } from '@mysten/sui/client';
import Decimal from 'decimal.js';
import { FastifyInstance } from 'fastify';

import { gatewayApp } from '../../../../src/app';
import { Sui } from '../../../../src/chains/sui/sui';
import { Bluefin } from '../../../../src/connectors/bluefin/bluefin';
import mockCollectFeeAndRewards from '../mocks/bluefin-clmm-collectFeeAndRewards.json';
import mockGetAccruedFeeAndRewards from '../mocks/bluefin-clmm-getAccruedFeeAndRewards.json';
import mockPositionDetails from '../mocks/bluefin-clmm-positionDetails.json';

let app: FastifyInstance;

beforeAll(async () => {
  app = await gatewayApp;
  await app.ready();
});

afterAll(() => {
  app.close();
});

describe('POST /connectors/bluefin/clmm/collect-fees', () => {
  const walletAddress = '0xaf9306cac62396be300b175046140c392eed876bd8ac0efac6301cea286fa272';
  const positionAddress = '0xd13d312ec4a31b2ef873568bf8115ea4bb381583a226bfb20cbd60ce1abb7844';

  const mockBluefin = {
    query: {
      getPositionDetails: jest.fn(),
      getPool: jest.fn(),
    },
    onChain: jest.fn().mockReturnThis(),
    collectFeeAndRewards: jest.fn(),
    getAccruedFeeAndRewards: jest.fn(),
  };

  const mockSui = {
    getWallet: jest.fn(),
    getTransactionBlock: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Bluefin, 'getInstance').mockReturnValue(mockBluefin as any);
    jest.spyOn(Sui, 'getInstance').mockResolvedValue(mockSui as any);
    // Mock the onChain call chain
    (mockBluefin.onChain as jest.Mock).mockReturnValue({
      collectFeeAndRewards: mockBluefin.collectFeeAndRewards,
      getAccruedFeeAndRewards: mockBluefin.getAccruedFeeAndRewards,
      queryChain: {
        getPool: mockBluefin.query.getPool,
      },
    });
  });

  it('should collect fees and return transaction details', async () => {
    // Arrange
    const mockSdkPool: any = require('../mocks/bluefin-clmm-pool-info.json');
    mockBluefin.query.getPositionDetails.mockResolvedValue(mockPositionDetails);
    mockBluefin.query.getPool.mockResolvedValue(mockSdkPool);
    mockBluefin.getAccruedFeeAndRewards.mockResolvedValue(mockGetAccruedFeeAndRewards);
    mockBluefin.collectFeeAndRewards.mockResolvedValue(mockCollectFeeAndRewards);

    // Act
    const response = await app.inject({
      method: 'POST',
      url: '/connectors/bluefin/clmm/collect-fees',
      payload: {
        network: 'mainnet',
        walletAddress: walletAddress,
        positionAddress: positionAddress,
      },
    });

    // Assert
    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body);

    const baseFeeCollected = new Decimal(mockGetAccruedFeeAndRewards.fee.coinA)
      .div(10 ** mockSdkPool.coin_a.decimals)
      .toNumber();
    const quoteFeeCollected = new Decimal(mockGetAccruedFeeAndRewards.fee.coinB)
      .div(10 ** mockSdkPool.coin_b.decimals)
      .toNumber();
    const expectedFee = new Decimal(mockCollectFeeAndRewards.effects.gasUsed.computationCost)
      .add(mockCollectFeeAndRewards.effects.gasUsed.storageCost)
      .sub(mockCollectFeeAndRewards.effects.gasUsed.storageRebate)
      .div(1e9)
      .toNumber();

    console.log('Actual Response Body:', JSON.stringify(responseBody, null, 2));
    console.log('Expected Signature:', mockCollectFeeAndRewards.digest);
    console.log('Expected Fee:', expectedFee);
    console.log('Expected Base Fee Collected:', baseFeeCollected);
    console.log('Expected Quote Fee Collected:', quoteFeeCollected);

    expect(responseBody.signature).toEqual(mockCollectFeeAndRewards.digest);
    expect(responseBody.status).toBe(1);
    expect(responseBody.data.fee).toBeCloseTo(expectedFee);
    expect(responseBody.data.baseFeeAmountCollected).toBeCloseTo(baseFeeCollected);
    expect(responseBody.data.quoteFeeAmountCollected).toBeCloseTo(quoteFeeCollected);

    expect(mockBluefin.query.getPositionDetails).toHaveBeenCalledWith(positionAddress);
    expect(mockBluefin.getAccruedFeeAndRewards).toHaveBeenCalled();
    expect(mockBluefin.collectFeeAndRewards).toHaveBeenCalled();
  });
});
