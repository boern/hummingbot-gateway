import { ClmmPoolUtil, ILiquidityParams } from '@firefly-exchange/library-sui/dist/src/spot';
import { BN } from 'bn.js';
import Decimal from 'decimal.js';
import { FastifyInstance, FastifyRequest } from 'fastify';

import { Sui } from '../../../chains/sui/sui';
import { RemoveLiquidityResponse } from '../../../schemas/clmm-schema';
import { logger } from '../../../services/logger';
import { Bluefin } from '../bluefin';
import { BluefinCLMMRemoveLiquidityRequest } from '../schemas';

import { getPool } from './poolInfo';

export const removeLiquidityRoute = async (fastify: FastifyInstance) => {
  fastify.post(
    '/remove-liquidity',
    {
      schema: {
        description: 'Remove liquidity from an existing Bluefin CLMM position',
        tags: ['/connector/bluefin'],
        body: BluefinCLMMRemoveLiquidityRequest,
        response: {
          200: RemoveLiquidityResponse,
        },
      },
    },
    async (req: FastifyRequest<{ Body: BluefinCLMMRemoveLiquidityRequest }>, reply) => {
      try {
        const { network = 'mainnet', walletAddress, positionId, percentage = 100, slippage = 0.5 } = req.body;

        const bluefin = Bluefin.getInstance(network);
        const onChain = bluefin.onChain;

        const position = await bluefin.query.getPositionDetails(positionId);
        const pool = await getPool(position.pool_id, network);

        const liquidityToRemove = new BN(position.liquidity).mul(new BN(percentage)).div(new BN(100));

        const curSqrtPrice = new BN(pool.current_sqrt_price);
        const lowerSqrtPrice = new BN(position.lower_sqrt_price);
        const upperSqrtPrice = new BN(position.upper_sqrt_price);

        const coinAmounts = ClmmPoolUtil.getCoinAmountFromLiquidity(
          liquidityToRemove,
          curSqrtPrice,
          lowerSqrtPrice,
          upperSqrtPrice,
          false,
        );

        const liquidityInput: ILiquidityParams = {
          liquidity: liquidityToRemove.toNumber(),
          minCoinAmounts: {
            coinA: new BN(
              new Decimal(coinAmounts.coinA.toString())
                .mul(1 - slippage / 100)
                .floor()
                .toString(),
            ),
            coinB: new BN(
              new Decimal(coinAmounts.coinB.toString())
                .mul(1 - slippage / 100)
                .floor()
                .toString(),
            ),
          },
        };

        const sui = Sui.getInstance(network);
        const keypair = sui.getWallet(walletAddress).keypair;
        onChain.signerConfig.signer = keypair;

        const tx = await onChain.removeLiquidity(pool, positionId, liquidityInput);

        reply.send({ txHash: tx.digest });
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
