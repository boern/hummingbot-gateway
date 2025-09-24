import { TickMath, ClmmPoolUtil } from '@firefly-exchange/library-sui';
import { IPosition, Pool } from '@firefly-exchange/library-sui/spot';
import { Type } from '@sinclair/typebox';
import { BN } from 'bn.js';
import Decimal from 'decimal.js';
import { FastifyInstance, FastifyRequest } from 'fastify';

import { PositionInfoSchema } from '../../../schemas/clmm-schema';
import { logger } from '../../../services/logger';
import { Bluefin } from '../bluefin';
import { bluefin_spot_contracts_mainnet, bluefin_spot_contracts_testnet } from '../bluefin.config';
import { BluefinCLMMGetPositionsOwnedRequest } from '../schemas';

import { getPool } from './poolInfo';

export async function toGatewayPosition(position: IPosition, network: string): Promise<typeof PositionInfoSchema.static> { // eslint-disable-line
  const pool: Pool = await getPool(position.pool_id, network);

  // Calculate the human-readable price for the lower and upper ticks.
  // The price is expressed in terms of the quote token (coin_b) per one unit of the base token (coin_a).
  const lowerPrice = TickMath.tickIndexToPrice(position.lower_tick, pool.coin_a.decimals, pool.coin_b.decimals);
  const upperPrice = TickMath.tickIndexToPrice(position.upper_tick, pool.coin_a.decimals, pool.coin_b.decimals);

  // Convert tick indices to their corresponding sqrtPriceX64 values for liquidity calculations.
  const lowerSqrtPrice = TickMath.tickIndexToSqrtPriceX64(position.lower_tick);
  const upperSqrtPrice = TickMath.tickIndexToSqrtPriceX64(position.upper_tick);

  const coinAmounts = ClmmPoolUtil.getCoinAmountFromLiquidity(
    new BN(position.liquidity),
    new BN(pool.current_sqrt_price),
    lowerSqrtPrice,
    upperSqrtPrice,
    false,
  );

  const price = TickMath.sqrtPriceX64ToPrice(
    new BN(pool.current_sqrt_price),
    pool.coin_a.decimals,
    pool.coin_b.decimals,
  );

  return {
    address: position.position_id,
    poolAddress: position.pool_id,
    baseTokenAddress: pool.coin_a.address,
    quoteTokenAddress: pool.coin_b.address,
    baseTokenAmount: new Decimal(coinAmounts.coinA.toString()).div(10 ** pool.coin_a.decimals).toNumber(),
    quoteTokenAmount: new Decimal(coinAmounts.coinB.toString()).div(10 ** pool.coin_b.decimals).toNumber(),
    baseFeeAmount: new Decimal(position.token_a_fee).div(10 ** pool.coin_a.decimals).toNumber(),
    quoteFeeAmount: new Decimal(position.token_b_fee).div(10 ** pool.coin_b.decimals).toNumber(),
    lowerBinId: position.lower_tick,
    upperBinId: position.upper_tick,
    lowerPrice: lowerPrice.toNumber(),
    upperPrice: upperPrice.toNumber(),
    price: price.toNumber(),
  };
}

export const positionsOwnedRoute = async (fastify: FastifyInstance) => {
  fastify.get(
    '/positions-owned',
    {
      schema: {
        description: 'Get owned Bluefin CLMM positions for a wallet address',
        tags: ['/connector/bluefin'],
        querystring: BluefinCLMMGetPositionsOwnedRequest,
        response: {
          200: Type.Array(PositionInfoSchema),
        },
      },
    },
    async (req: FastifyRequest<{ Querystring: BluefinCLMMGetPositionsOwnedRequest }>, reply) => {
      try {
        const { walletAddress, poolAddress, network = 'mainnet' } = req.query;
        logger.info(
          `[Bluefin] Received /positions-owned request for wallet ${walletAddress} on pool ${poolAddress}, network ${network}`,
        );

        const bluefin = Bluefin.getInstance(network);
        const bluefin_spot_contracts =
          network === 'mainnet' ? bluefin_spot_contracts_mainnet : bluefin_spot_contracts_testnet;

        logger.info(`[Bluefin] Fetching all positions for wallet ${walletAddress}...`);
        const allPositions = await bluefin.query.getUserPositions(
          bluefin_spot_contracts.BasePackage, // BasePackage is same for mainnet and testnet
          walletAddress,
        );
        logger.info(`[Bluefin] Total positions:  ${JSON.stringify(allPositions, null, 2)}`);
        const filteredPositions = allPositions.filter((p) => p.pool_id === poolAddress);
        const positions = await Promise.all(filteredPositions.map((p) => toGatewayPosition(p, network)));
        logger.info(`[Bluefin] Sending ${positions.length} filtered positions.`);
        reply.send(positions);
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
