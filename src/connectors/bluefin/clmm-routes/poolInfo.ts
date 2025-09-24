import { TickMath } from '@firefly-exchange/library-sui';
import { Pool } from '@firefly-exchange/library-sui/spot';
import { BN } from 'bn.js';
import Decimal from 'decimal.js';
import { FastifyInstance, FastifyRequest } from 'fastify';

import { PoolInfoSchema } from '../../../schemas/clmm-schema'; // 기존 스키마
import { logger } from '../../../services/logger';
import { Bluefin } from '../bluefin';
import { BluefinCLMMGetPoolInfoRequest } from '../schemas';
// import { bluefin_spot_contracts_mainnet, bluefin_spot_contracts_testnet } from '../bluefin.config';

export async function getPool(poolId: string, network: string): Promise<Pool> {
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

        logger.info(`[Bluefin] Fetching pool info for pool address ${poolAddress} on network ${network}`);
        const pool: Pool = await getPool(poolAddress, network);
        logger.info(`[Bluefin] Pool data fetched successfully. Pool info :${JSON.stringify(pool, null, 2)}`);

        const price = TickMath.sqrtPriceX64ToPrice(
          new BN(pool.current_sqrt_price),
          pool.coin_a.decimals,
          pool.coin_b.decimals,
        );

        const poolInfo: typeof PoolInfoSchema.static = { // eslint-disable-line
          address: pool.id,
          baseTokenAddress: pool.coin_a.address,
          quoteTokenAddress: pool.coin_b.address,
          binStep: pool.ticks_manager.tick_spacing,
          feePct: new Decimal(pool.fee_rate).div(1e6).toNumber(),
          price: price.toNumber(),
          // Use the balance fields from the pool object, which represent the total liquidity in the pool's vaults.
          baseTokenAmount: new Decimal(pool.coin_a.balance).div(new Decimal(10).pow(pool.coin_a.decimals)).toNumber(),
          quoteTokenAmount: new Decimal(pool.coin_b.balance).div(new Decimal(10).pow(pool.coin_b.decimals)).toNumber(),
          activeBinId: parseInt(pool.current_tick.toString()),
        };

        logger.info(`[Bluefin] Sending pool info: ${JSON.stringify(poolInfo, null, 2)}`);
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
