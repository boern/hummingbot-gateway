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
  app.close();
});

describe('Bluefin Router quoteSwap', () => {
  it('should return a swap quote', async () => {
    // Test implementation will go here
  });
  describe('POST /connectors/bluefin/router/quote-swap', () => {
    const poolAddress = '0xa701a909673dbc597e63b4586ace6643c02ac0e118382a78b9a21262a4a2e35d';
    const tokenIn = '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI';
    const tokenOut = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';

    const mockBluefin = {
      query: { getPool: jest.fn() },
      onChain: { computeSwapResults: jest.fn() },
    };

    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(Bluefin, 'getInstance').mockReturnValue(mockBluefin as any);
    });

    it('should return a swap quote', async () => {
      // Arrange
      // ... mock implementation for getPool and computeSwapResults
      // Act
      // ... app.inject call
      // Assert
      // ... expect assertions
    });
  });
});
