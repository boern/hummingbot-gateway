import { ClmmPoolUtil, toBigNumberStr } from '@firefly-exchange/library-sui';
import { SuiTransactionBlockResponse } from '@mysten/sui/client';
import { BN } from 'bn.js';
import { FastifyInstance, FastifyRequest } from 'fastify';

import { Sui } from '../../../chains/sui/sui';
import { AddLiquidityResponse } from '../../../schemas/clmm-schema';
import { logger } from '../../../services/logger';
import { Bluefin } from '../bluefin';
import { BluefinCLMMAddLiquidityRequest } from '../schemas';

import { getPool } from './poolInfo';

export const addLiquidityRoute = async (fastify: FastifyInstance) => {
  fastify.post(
    '/add-liquidity',
    {
      schema: {
        description: 'Add liquidity to an existing Bluefin CLMM position',
        tags: ['/connector/bluefin'],
        body: BluefinCLMMAddLiquidityRequest,
        response: {
          200: AddLiquidityResponse,
        },
      },
    },
    async (req: FastifyRequest<{ Body: BluefinCLMMAddLiquidityRequest }>, reply) => {
      try {
        const { network = 'mainnet', walletAddress, positionId, amount0, amount1, slippage = 0.5 } = req.body;

        if (amount0 === undefined && amount1 === undefined) {
          throw fastify.httpErrors.badRequest('Either amount0 or amount1 must be provided.');
        }

        const bluefin = Bluefin.getInstance(network);
        const onChain = bluefin.onChain;

        const position = await bluefin.query.getPositionDetails(positionId);
        const pool = await getPool(position.pool_id, network);

        // The SDK's `estLiquidityAndCoinAmountFromOneAmounts` requires one amount.
        // We will prioritize amount0 if both are provided.
        const fix_amount_a = amount0 !== undefined;
        const amount = fix_amount_a ? amount0! : amount1!;
        const decimals = fix_amount_a ? pool.coin_a.decimals : pool.coin_b.decimals;

        const coinAmountBN = new BN(toBigNumberStr(amount, decimals));

        const curSqrtPrice = new BN(pool.current_sqrt_price);
        const roundUp = true; // When adding liquidity, we want to round up to get the minimum liquidity for the input amount.

        const liquidityInput = ClmmPoolUtil.estLiquidityAndCoinAmountFromOneAmounts(
          position.lower_tick,
          position.upper_tick,
          coinAmountBN,
          fix_amount_a,
          roundUp,
          slippage,
          curSqrtPrice,
        );

        const sui = Sui.getInstance(network);
        const keypair = (sui as any).getWallet(walletAddress).keypair;
        onChain.signerConfig.signer = keypair;

        const tx = await onChain.provideLiquidityWithFixedAmount(pool, positionId, liquidityInput);

        reply.send({
          txHash: (tx as SuiTransactionBlockResponse).digest,
          positionId: positionId,
          amount0: liquidityInput.coinAmountA.toString(),
          amount1: liquidityInput.coinAmountB.toString(),
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
