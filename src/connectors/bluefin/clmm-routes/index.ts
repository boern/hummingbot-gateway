import { FastifyInstance } from 'fastify';

import { addLiquidityRoute } from './addLiquidity';
import { closePositionRoute } from './closePosition';
import { collectFeesRoute } from './collectFees';
import { executeSwapRoute } from './executeSwap';
import { getAccruedFeeAndRewardsRoute } from './getAccruedRewards';
import { openPositionRoute } from './openPosition';
import { poolInfoRoute } from './poolInfo';
import { positionInfoRoute } from './positionInfo';
import { positionsOwnedRoute } from './positionsOwned';
import { quotePositionRoute } from './quotePosition';
import { quoteSwapRoute } from './quoteSwap';
import { removeLiquidityRoute } from './removeLiquidity';

export async function bluefinCLMMRoutes(fastify: FastifyInstance) {
  fastify.register(poolInfoRoute);
  fastify.register(positionsOwnedRoute);
  fastify.register(positionInfoRoute);
  fastify.register(quotePositionRoute);
  fastify.register(quoteSwapRoute);
  fastify.register(executeSwapRoute);
  fastify.register(openPositionRoute);
  fastify.register(addLiquidityRoute);
  fastify.register(removeLiquidityRoute);
  fastify.register(closePositionRoute);
  fastify.register(collectFeesRoute);
  fastify.register(getAccruedFeeAndRewardsRoute);
}

export default bluefinCLMMRoutes;
