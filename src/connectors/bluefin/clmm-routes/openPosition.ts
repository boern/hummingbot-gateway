import { TickMath, ClmmPoolUtil, toBigNumberStr } from '@firefly-exchange/library-sui';
import { ILiquidityParams } from '@firefly-exchange/library-sui/spot';
import { SuiTransactionBlockResponse } from '@mysten/sui/client';
import { BN } from 'bn.js';
import Decimal, { Decimal as DecimalJS } from 'decimal.js';
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
          baseTokenAmount,
          quoteTokenAmount,
          slippagePct: slippage = 0.5,
        } = req.body;

        if (baseTokenAmount === undefined && quoteTokenAmount === undefined) {
          throw fastify.httpErrors.badRequest('Either baseTokenAmount or quoteTokenAmount must be provided.');
        }

        if (lowerPrice >= upperPrice) {
          throw fastify.httpErrors.badRequest('lowerPrice must be less than upperPrice.');
        }

        const bluefin = Bluefin.getInstance(network);
        const pool = await getPool(poolAddress, network);

        const amountaBN = baseTokenAmount ? new BN(toBigNumberStr(baseTokenAmount, pool.coin_a.decimals)) : new BN(0);
        const amountbBN = quoteTokenAmount ? new BN(toBigNumberStr(quoteTokenAmount, pool.coin_b.decimals)) : new BN(0);

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
          coinA: amountaBN,
          coinB: amountbBN,
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

        const sui = await Sui.getInstance(network);
        const keypair = await sui.getWallet(walletAddress); // Use the standardized wallet retrieval
        const onChain = bluefin.onChain(keypair);
        const tx = await onChain.openPositionWithLiquidity(pool, liquidityInput);

        const txResponse = tx as SuiTransactionBlockResponse;

        if (txResponse.effects?.status.status === 'success') {
          // Fetch transaction details to provide a more complete response
          const txDetails = await sui.getTransactionBlock(txResponse.digest);

          const liquidityProvidedEvent = txDetails.events.find((e) => e.type.endsWith('::events::LiquidityProvided'))
            ?.parsedJson as any;

          const positionId = liquidityProvidedEvent?.position_id;

          reply.send({
            signature: txResponse.digest,
            status: 1, // CONFIRMED
            data: {
              fee: new DecimalJS(txDetails.effects.gasUsed.computationCost)
                .add(txDetails.effects.gasUsed.storageCost)
                .sub(txDetails.effects.gasUsed.storageRebate)
                .div(1e9)
                .toNumber(),
              positionAddress: positionId, // Sui model doesn't have explicit rent like Solana
              positionRent: new DecimalJS(txDetails.effects.gasUsed.storageCost).div(1e9).toNumber(),
              baseTokenAmountAdded: new Decimal(liquidityProvidedEvent.coin_a_amount)
                .div(10 ** pool.coin_a.decimals)
                .toNumber(),
              quoteTokenAmountAdded: new Decimal(liquidityProvidedEvent.coin_b_amount)
                .div(10 ** pool.coin_b.decimals)
                .toNumber(),
            },
          });
        } else if (txResponse.effects?.status.status === 'failure') {
          logger.error(`Open position failed for pool ${poolAddress}: ${txResponse.effects.status.error}`);
          throw fastify.httpErrors.internalServerError(
            `Transaction to open position failed: ${txResponse.effects.status.error}`,
          );
        } else {
          reply.send({
            signature: txResponse.digest,
            status: 0, // PENDING
          });
        }
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
