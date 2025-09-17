import { FastifyInstance } from 'fastify';

import { addLiquidityRoute } from './addLiquidity';
import { collectFeesRoute } from './collectFees';
import { openPositionRoute } from './openPosition';
import { poolInfoRoute } from './poolInfo';
import { positionsOwnedRoute } from './positionsOwned';
import { removeLiquidityRoute } from './removeLiquidity';

export async function bluefinCLMMRoutes(fastify: FastifyInstance) {
  fastify.register(poolInfoRoute);
  fastify.register(positionsOwnedRoute);
  fastify.register(openPositionRoute);
  fastify.register(addLiquidityRoute);
  fastify.register(removeLiquidityRoute);
  fastify.register(collectFeesRoute);
}

export default bluefinCLMMRoutes;
