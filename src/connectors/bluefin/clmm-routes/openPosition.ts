import { TickMath, ClmmPoolUtil, toBigNumberStr } from '@firefly-exchange/library-sui';
import { ILiquidityParams } from '@firefly-exchange/library-sui/spot';
import { SuiTransactionBlockResponse } from '@mysten/sui/client';
import { BN } from 'bn.js';
import Decimal from 'decimal.js';
import { FastifyInstance, FastifyRequest } from 'fastify';

import { Sui } from '../../../chains/sui/sui';
import { OpenPositionResponse } from '../../../schemas/clmm-schema';
import { logger } from '../../../services/logger';
import { Bluefin } from '../bluefin';
import { BluefinCLMMOpenPositionRequest } from '../schemas';

import { getPool } from './poolInfo';

export const openPositionRoute = async (fastify: FastifyInstance) => {
  fastify.post(
    '/open-position',
    {
      schema: {
        description: 'Open a new Bluefin CLMM position',
        tags: ['/connector/bluefin'],
        body: BluefinCLMMOpenPositionRequest,
        response: {
          200: OpenPositionResponse,
        },
      },
    },
    async (req: FastifyRequest<{ Body: BluefinCLMMOpenPositionRequest }>, reply) => {
      try {
        const {
          network = 'mainnet',
          walletAddress,
          poolAddress,
          lowerPrice,
          upperPrice,
          amount0,
          amount1,
          slippage = 0.5,
        } = req.body;

        if (amount0 === undefined && amount1 === undefined) {
          throw fastify.httpErrors.badRequest('Either amount0 or amount1 must be provided.');
        }

        const bluefin = Bluefin.getInstance(network);
        const pool = await getPool(poolAddress, network);

        const amount0BN = amount0 ? new BN(toBigNumberStr(amount0, pool.coin_a.decimals)) : new BN(0);
        const amount1BN = amount1 ? new BN(toBigNumberStr(amount1, pool.coin_b.decimals)) : new BN(0);

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
          coinA: amount0BN,
          coinB: amount1BN,
        });

        const lowerSqrtPriceBN = TickMath.tickIndexToSqrtPriceX64(lowerTick);
        const upperSqrtPriceBN = TickMath.tickIndexToSqrtPriceX64(upperTick);
        const coinAmounts = ClmmPoolUtil.getCoinAmountFromLiquidity(
          liquidityAmount,
          curSqrtPrice,
          lowerSqrtPriceBN,
          upperSqrtPriceBN,
          true,
        );

        const liquidityInput: ILiquidityParams = {
          lowerPrice,
          upperPrice,
          lowerPriceX64: lowerSqrtPriceBN,
          upperPriceX64: upperSqrtPriceBN,
          lowerTick,
          upperTick,
          liquidity: liquidityAmount.toNumber(),
          coinAmounts: coinAmounts,
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
        const keypair = (sui as any).getWallet(walletAddress).keypair;
        const onChain = bluefin.onChain;
        onChain.signerConfig.signer = keypair;

        const tx = await onChain.openPositionWithLiquidity(pool, liquidityInput);

        reply.send({
          txHash: (tx as SuiTransactionBlockResponse).digest,
          positionId: (tx as SuiTransactionBlockResponse).effects?.created?.[0]?.reference.objectId,
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
