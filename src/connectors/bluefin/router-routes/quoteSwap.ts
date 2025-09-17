import { toBigNumber } from '@firefly-exchange/library-sui';
import { ISwapParams } from '@firefly-exchange/library-sui/spot';
import Decimal from 'decimal.js';
import { FastifyInstance, FastifyRequest } from 'fastify';

import { QuoteSwapResponse } from '../../../schemas/router-schema';
import { logger } from '../../../services/logger';
import { Bluefin } from '../bluefin';
import { getPool } from '../clmm-routes/poolInfo';
import { BluefinRouterQuoteSwapRequest } from '../schemas';

export const quoteSwapRoute = async (fastify: FastifyInstance) => {
  fastify.post(
    '/quote-swap',
    {
      schema: {
        description: 'Get a swap quote from Bluefin router',
        tags: ['/connector/bluefin'],
        body: BluefinRouterQuoteSwapRequest,
        response: {
          200: QuoteSwapResponse,
        },
      },
    },
    async (req: FastifyRequest<{ Body: BluefinRouterQuoteSwapRequest }>, reply) => {
      try {
        const { network = 'mainnet', poolAddress, tokenIn, tokenOut, amount, slippage = 0.5 } = req.body;

        const bluefin = Bluefin.getInstance(network);
        const onChain = bluefin.onChain;

        const pool = await getPool(poolAddress, network);

        const aToB = tokenIn === pool.coin_a.address && tokenOut === pool.coin_b.address;

        if (!aToB && (tokenIn !== pool.coin_b.address || tokenOut !== pool.coin_a.address)) {
          throw fastify.httpErrors.badRequest('Invalid token pair for the given pool.');
        }

        const inputDecimals = aToB ? pool.coin_a.decimals : pool.coin_b.decimals;
        const outputDecimals = aToB ? pool.coin_b.decimals : pool.coin_a.decimals;

        const swapParams: ISwapParams = {
          pool: pool,
          amountIn: toBigNumber(Number(amount), inputDecimals),
          amountOut: 0,
          aToB: aToB,
          byAmountIn: true,
          slippage: slippage,
        };

        const swapResult = await onChain.computeSwapResults(swapParams);

        const expectedAmountOut = new Decimal(swapResult.amount_out.toString()).div(10 ** outputDecimals).toString();

        reply.send({
          amount: expectedAmountOut,
          // Bluefin SDK does not directly expose price impact or fee in computeSwapResults
          // These would need to be calculated separately or are part of the swap result.
        });
      } catch (e) {
        if (e instanceof Error) {
          logger.error(e.message);
          throw fastify.httpErrors.internalServerError(e.message);
        }
        throw e;
      }
    },
  );
};
