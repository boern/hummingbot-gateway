import { FastifyInstance } from 'fastify';

import { executeQuoteRoute } from './executeQuote';
import { executeSwapRoute } from './executeSwap';
import { getPriceRoute } from './getPrice';
import { quoteSwapRoute } from './quoteSwap';

export async function bluefinRouterRoutes(fastify: FastifyInstance) {
  await fastify.register(quoteSwapRoute);
  await fastify.register(executeSwapRoute);
  await fastify.register(getPriceRoute);
  await fastify.register(executeQuoteRoute);
}

export default bluefinRouterRoutes;
