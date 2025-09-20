import { toBigNumber } from '@firefly-exchange/library-sui';
import { SuiTransactionBlockResponse } from '@mysten/sui/client';
import Decimal from 'decimal.js';
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

describe('POST /connectors/bluefin/clmm/execute-swap', () => {
  const poolAddress = '0xbcc6909d2e85c06cf9cbfe5b292da36f5bfa0f314806474bbf6a0bf9744d37ce';
  const walletAddress = '0xaf9306cac62396be300b175046140c392eed876bd8ac0efac6301cea286fa272';
  const baseToken = 'WAL';
  const quoteToken = 'USDC';
  const amount = 20;
  const side = 'SELL';
  const slippagePct = 0.5;

  const mockBluefin = {
    onChain: jest.fn().mockReturnValue({
      swapAssets: jest.fn(),
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
    jest.spyOn(Sui, 'getInstance').mockResolvedValue(mockSui as any);
    jest.spyOn(Bluefin, 'getInstance').mockReturnValue(mockBluefin as any);
  });

  it('should execute a swap and return confirmed data', async () => {
    // Arrange
    const mockTxResponse: SuiTransactionBlockResponse = require('../mocks/bluefin-clmm-swapAssets-a2b.json');
    const mockSdkPool: any = require('../mocks/bluefin-clmm-pool-info.json');

    mockBluefin.query.getPool.mockResolvedValue(mockSdkPool);
    (mockBluefin.onChain().swapAssets as jest.Mock).mockResolvedValue(mockTxResponse);

    // Act
    const response = await app.inject({
      method: 'POST',
      url: '/connectors/bluefin/clmm/execute-swap',
      payload: {
        network: 'mainnet',
        walletAddress: walletAddress,
        poolAddress: poolAddress,
        baseToken: baseToken,
        quoteToken: quoteToken,
        amount: amount,
        side: side,
        slippagePct: slippagePct,
      },
    });

    // Assert
    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body);

    expect(responseBody).toEqual({
      signature: 'Fyy9HfmVfr9HZTWW5M1aW3Q3hsH8EsKmnSFrpuMfxWhv',
      status: 1,
      data: {
        tokenIn: 'WAL',
        tokenOut: 'USDC',
        amountIn: 20,
        amountOut: 8.442831,
        fee: 0.00241538,
        baseTokenBalanceChange: -20,
        quoteTokenBalanceChange: 8.442831,
      },
    });

    // Verify that the mocked functions were called with the correct parameters
    expect(Bluefin.getInstance).toHaveBeenCalledWith('mainnet');
    expect(mockBluefin.query.getPool).toHaveBeenCalledWith(poolAddress);
    expect(mockBluefin.onChain().swapAssets).toHaveBeenCalledWith({
      pool: mockSdkPool,
      amountIn: toBigNumber(amount, mockSdkPool.coin_a.decimals),
      amountOut: 0,
      aToB: true,
      byAmountIn: true,
      slippage: slippagePct,
    });
  });

  it('should handle transaction failure', async () => {
    // Arrange
    const mockTxResponse: SuiTransactionBlockResponse = JSON.parse(
      JSON.stringify(require('../mocks/bluefin-clmm-swapAssets-a2b.json')),
    );
    mockTxResponse.effects!.status.status = 'failure';
    mockTxResponse.effects!.status.error = 'Simulated transaction failure';
    const mockSdkPool: any = require('../mocks/bluefin-clmm-pool-info.json');

    mockBluefin.query.getPool.mockResolvedValue(mockSdkPool);
    (mockBluefin.onChain().swapAssets as jest.Mock).mockResolvedValue(mockTxResponse);

    // Act
    const response = await app.inject({
      method: 'POST',
      url: '/connectors/bluefin/clmm/execute-swap',
      payload: {
        network: 'mainnet',
        walletAddress: walletAddress,
        poolAddress: poolAddress,
        baseToken: baseToken,
        quoteToken: quoteToken,
        amount: amount,
        side: side,
        slippagePct: slippagePct,
      },
    });

    // Assert
    expect(response.statusCode).toBe(500);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.message).toEqual('Transaction to execute swap failed: Simulated transaction failure');
  });

  it('should handle missing swap event', async () => {
    // Arrange
    const mockTxResponse: SuiTransactionBlockResponse = JSON.parse(
      JSON.stringify(require('../mocks/bluefin-clmm-swapAssets-a2b.json')),
    );
    mockTxResponse.events = []; // Simulate missing event
    const mockSdkPool: any = require('../mocks/bluefin-clmm-pool-info.json');

    mockBluefin.query.getPool.mockResolvedValue(mockSdkPool);
    (mockBluefin.onChain().swapAssets as jest.Mock).mockResolvedValue(mockTxResponse);

    // Act
    const response = await app.inject({
      method: 'POST',
      url: '/connectors/bluefin/clmm/execute-swap',
      payload: {
        network: 'mainnet',
        walletAddress: walletAddress,
        poolAddress: poolAddress,
        baseToken: baseToken,
        quoteToken: quoteToken,
        amount: amount,
        side: side,
        slippagePct: slippagePct,
      },
    });

    // Assert
    expect(response.statusCode).toBe(500);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.message).toEqual('Swap event not found in successful transaction');
  });

  it('should throw bad request for invalid token pair', async () => {
    // Arrange
    const mockSdkPool: any = require('../mocks/bluefin-clmm-pool-info.json');
    mockBluefin.query.getPool.mockResolvedValue(mockSdkPool);

    // Act
    const response = await app.inject({
      method: 'POST',
      url: '/connectors/bluefin/clmm/execute-swap',
      payload: {
        network: 'mainnet',
        walletAddress: walletAddress,
        poolAddress: poolAddress,
        baseToken: 'INVALID_TOKEN', // Invalid token
        quoteToken: quoteToken,
        amount: amount,
        side: 'SELL',
        slippagePct: slippagePct,
      },
    });

    // Assert
    expect(response.statusCode).toBe(400);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.message).toEqual('Invalid token pair for the given pool.');
  });
});
