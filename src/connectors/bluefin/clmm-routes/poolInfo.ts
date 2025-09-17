import { TickMath } from '@firefly-exchange/library-sui';
import { BN } from 'bn.js';
import Decimal from 'decimal.js';
import { FastifyInstance, FastifyRequest } from 'fastify';

import { PoolInfoSchema } from '../../../schemas/clmm-schema';
import { logger } from '../../../services/logger';
import { Bluefin } from '../bluefin';
import { BluefinCLMMGetPoolInfoRequest } from '../schemas';

export async function getPool(poolId: string, network: string) {
  const bluefin = Bluefin.getInstance(network);
  const pool = await bluefin.query.getPool(poolId);
  return pool;
}

export const poolInfoRoute = async (fastify: FastifyInstance) => {
  fastify.get(
    '/pool-info',
    {
      schema: {
        description: 'Get Bluefin CLMM pool info',
        tags: ['/connector/bluefin'],
        querystring: BluefinCLMMGetPoolInfoRequest,
        response: {
          200: PoolInfoSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: typeof BluefinCLMMGetPoolInfoRequest.static }>, reply) => {
      try {
        const { poolAddress, network = 'mainnet' } = request.query;
        const pool = await getPool(poolAddress, network);

        const price = TickMath.sqrtPriceX64ToPrice(
          new BN(pool.current_sqrt_price),
          pool.coin_a.decimals,
          pool.coin_b.decimals,
        );

        const poolInfo: typeof PoolInfoSchema.static = {
          address: pool.id,
          baseTokenAddress: pool.coin_a.address,
          quoteTokenAddress: pool.coin_b.address,
          binStep: pool.ticks_manager.tick_spacing,
          feePct: new Decimal(pool.fee_rate).div(1e6).toNumber(), // fee_rate is in millionths
          price: price.toNumber(),
          // The following are placeholders as Bluefin SDK doesn't directly provide total liquidity in token amounts
          baseTokenAmount: 0,
          quoteTokenAmount: 0,
          activeBinId: parseInt(pool.current_tick.toString()),
        };

        reply.send(poolInfo);
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
