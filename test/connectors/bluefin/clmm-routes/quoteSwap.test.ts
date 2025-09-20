import { toBigNumber } from '@firefly-exchange/library-sui';
import Decimal from 'decimal.js';
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

describe('GET /connectors/bluefin/clmm/quote-swap', () => {
  const poolAddress = '0xbcc6909d2e85c06cf9cbfe5b292da36f5bfa0f314806474bbf6a0bf9744d37ce';
  const baseToken = 'WAL';
  const quoteToken = 'USDC';
  const amount = 200;
  const side = 'SELL';
  const slippagePct = 0.5;

  const mockBluefin = {
    onChain: jest.fn().mockReturnValue({
      computeSwapResults: jest.fn(),
    }),
    query: {
      getPool: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Bluefin, 'getInstance').mockReturnValue(mockBluefin as any);
  });

  it('should return a swap quote based on computeSwapResults mock data', async () => {
    // Arrange
    const mockComputeSwapResults: any = require('../mocks/bluefin-clmm-computeSwapResults.json');
    const mockSdkPool: any = require('../mocks/bluefin-clmm-pool-info.json');

    mockBluefin.query.getPool.mockResolvedValue(mockSdkPool);
    (mockBluefin.onChain().computeSwapResults as jest.Mock).mockResolvedValue(mockComputeSwapResults);

    // Act
    const response = await app.inject({
      method: 'GET',
      url: '/connectors/bluefin/clmm/quote-swap',
      query: {
        network: 'mainnet',
        poolAddress: poolAddress,
        baseToken: baseToken,
        quoteToken: quoteToken,
        amount: amount.toString(),
        side: side,
        slippagePct: slippagePct.toString(),
      },
    });

    // Assert
    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body);
    console.log('Actual Response Body:', JSON.stringify(responseBody, null, 2));
    const expectedAmountOut = new Decimal(mockComputeSwapResults.events[0].parsedJson.amount_calculated)
      .div(10 ** mockSdkPool.coin_b.decimals)
      .toNumber();
    console.log('Expected Amount Out:', expectedAmountOut);

    // Perform assertions on the response body based on the mock data
    expect(responseBody).toEqual({
      poolAddress: '0xbcc6909d2e85c06cf9cbfe5b292da36f5bfa0f314806474bbf6a0bf9744d37ce',
      tokenIn: baseToken,
      tokenOut: quoteToken,
      amountIn: amount,
      amountOut: 84.198597,
      price: 0.42099298500000004,
      slippagePct: slippagePct,
      minAmountOut: 83.777604,
      maxAmountIn: 200,
      priceImpactPct: 3.001147198465541,
    });

    // Verify that the mocked functions were called with the correct parameters
    expect(Bluefin.getInstance).toHaveBeenCalledWith('mainnet');
    expect(mockBluefin.query.getPool).toHaveBeenCalledWith(poolAddress);
    expect(mockBluefin.onChain().computeSwapResults).toHaveBeenCalledWith({
      pool: mockSdkPool,
      amountIn: toBigNumber(amount, mockSdkPool.coin_a.decimals),
      amountOut: 0,
      aToB: true,
      byAmountIn: true,
      slippage: slippagePct,
    });
  });
});
