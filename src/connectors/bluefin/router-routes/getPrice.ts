import Decimal from 'decimal.js';
import { FastifyInstance, FastifyRequest } from 'fastify';

import { logger } from '../../../services/logger';
import { Bluefin } from '../bluefin';
import { getPool } from '../clmm-routes/poolInfo';
import { BluefinRouterGetPriceRequest } from '../schemas';

export const getPriceRoute = async (fastify: FastifyInstance) => {
  fastify.get(
    '/get-price',
    {
      schema: {
        description: 'Get price estimate from Bluefin router',
        tags: ['/connector/bluefin'],
        querystring: BluefinRouterGetPriceRequest,
        response: {
          200: {
            type: 'object',
            properties: {
              price: { type: 'string' },
            },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Querystring: BluefinRouterGetPriceRequest }>, reply) => {
      try {
        const { network = 'mainnet', poolAddress, tokenIn } = req.query;

        const bluefin = Bluefin.getInstance(network);

        const pool = await getPool(poolAddress, network);

        // Check if the tokenIn is one of the pool's tokens
        if (tokenIn !== pool.coin_a.address && tokenIn !== pool.coin_b.address) {
          throw fastify.httpErrors.badRequest('Invalid tokenIn for the given pool.');
        }

        const price = Decimal.sqrt(new Decimal(pool.current_sqrt_price));
        reply.send({ price: price.toString() });
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
