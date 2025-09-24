import { ClmmPoolUtil, TickMath, toBigNumberStr } from '@firefly-exchange/library-sui';
import { BN } from 'bn.js';
import Decimal from 'decimal.js';
import { FastifyInstance, FastifyRequest } from 'fastify';

import { QuotePositionResponse, QuotePositionResponseType } from '../../../schemas/clmm-schema';
import { logger } from '../../../services/logger';
import { Bluefin } from '../bluefin';
import { BluefinCLMMQuotePositionRequest } from '../schemas';

import { getPool } from './poolInfo';

export async function quotePosition(
  fastify: FastifyInstance,
  network: string,
  lowerPrice: number,
  upperPrice: number,
  poolAddress: string,
  baseTokenAmount?: number,
  quoteTokenAmount?: number,
): Promise<QuotePositionResponseType> {
  if (baseTokenAmount === undefined && quoteTokenAmount === undefined) {
    logger.error('[Bluefin] quotePosition failed: Either baseTokenAmount or quoteTokenAmount must be provided.');
    throw fastify.httpErrors.badRequest('Either baseTokenAmount or quoteTokenAmount must be provided.');
  }

  if (lowerPrice >= upperPrice) {
    throw fastify.httpErrors.badRequest('lowerPrice must be less than upperPrice.');
  }

  logger.info(`[Bluefin] Quoting position for pool ${poolAddress} with price range ${lowerPrice}-${upperPrice}`);
  // const bluefin = Bluefin.getInstance(network);
  const pool = await getPool(poolAddress, network);
  logger.info(`[Bluefin] Fetched pool data for quote: ${JSON.stringify(pool, null, 2)}`);

  const amountABN = baseTokenAmount ? new BN(toBigNumberStr(baseTokenAmount, pool.coin_a.decimals)) : new BN(0);
  const amountBBN = quoteTokenAmount ? new BN(toBigNumberStr(quoteTokenAmount, pool.coin_b.decimals)) : new BN(0);

  const lowerTick = TickMath.priceToInitializableTickIndex(
    new Decimal(lowerPrice),
    pool.coin_a.decimals,
    pool.coin_b.decimals,
    pool.ticks_manager.tick_spacing,
  );
  const upperTick = TickMath.priceToInitializableTickIndex(
    new Decimal(upperPrice),
    pool.coin_a.decimals,
    pool.coin_b.decimals,
    pool.ticks_manager.tick_spacing,
  );

  const curSqrtPrice = new BN(pool.current_sqrt_price);

  const liquidityAmount = ClmmPoolUtil.estimateLiquidityFromCoinAmounts(curSqrtPrice, lowerTick, upperTick, {
    coinA: amountABN,
    coinB: amountBBN,
  });

  const lowerSqrtPriceBN = TickMath.tickIndexToSqrtPriceX64(lowerTick);
  const upperSqrtPriceBN = TickMath.tickIndexToSqrtPriceX64(upperTick);
  const coinAmounts = ClmmPoolUtil.getCoinAmountFromLiquidity(
    liquidityAmount,
    curSqrtPrice,
    lowerSqrtPriceBN,
    upperSqrtPriceBN,
    true, // roundUp
  );

  const baseLimited = baseTokenAmount !== undefined && quoteTokenAmount === undefined;

  const response: QuotePositionResponseType = {
    baseLimited: baseLimited,
    baseTokenAmount: new Decimal(coinAmounts.coinA.toString()).div(10 ** pool.coin_a.decimals).toNumber(),
    quoteTokenAmount: new Decimal(coinAmounts.coinB.toString()).div(10 ** pool.coin_b.decimals).toNumber(),
    baseTokenAmountMax: new Decimal(coinAmounts.coinA.toString()).div(10 ** pool.coin_a.decimals).toNumber(),
    quoteTokenAmountMax: new Decimal(coinAmounts.coinB.toString()).div(10 ** pool.coin_b.decimals).toNumber(),
    liquidity: liquidityAmount.toString(),
  };
  logger.info(`[Bluefin] Position quote successful. Response: ${JSON.stringify(response, null, 2)}`);
  return response;
}

export const quotePositionRoute = async (fastify: FastifyInstance) => {
  fastify.get(
    '/quote-position',
    {
      schema: {
        description: 'Quote amounts for a new Bluefin CLMM position',
        tags: ['/connector/bluefin'],
        querystring: BluefinCLMMQuotePositionRequest,
        response: {
          200: QuotePositionResponse,
        },
      },
    },
    async (
      req: FastifyRequest<{ Querystring: typeof BluefinCLMMQuotePositionRequest.static }>,
    ): Promise<QuotePositionResponseType> => {
      try {
        const {
          network = 'mainnet',
          lowerPrice,
          upperPrice,
          poolAddress,
          baseTokenAmount,
          quoteTokenAmount,
        } = req.query;
        logger.info(`[Bluefin] Received /quote-position request: ${JSON.stringify(req.query)}`);

        return await quotePosition(
          fastify,
          network,
          lowerPrice,
          upperPrice,
          poolAddress,
          baseTokenAmount,
          quoteTokenAmount,
        );
      } catch (e) {
        if (e instanceof Error) {
          logger.error(`[Bluefin] Error in /quote-position: ${e.message}`);
          throw fastify.httpErrors.internalServerError(e.message);
        }
        throw e;
      }
    },
  );
};
