import { ClmmPoolUtil, TickMath, toBigNumberStr } from '@firefly-exchange/library-sui';
import { ILiquidityParams } from '@firefly-exchange/library-sui/spot';
import { SuiTransactionBlockResponse } from '@mysten/sui/client';
import { BN } from 'bn.js';
import Decimal from 'decimal.js';
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
        const {
          network = 'mainnet',
          walletAddress,
          positionAddress,
          baseTokenAmount,
          quoteTokenAmount,
          slippagePct: slippage = 0.5,
        } = req.body;

        if (baseTokenAmount === undefined && quoteTokenAmount === undefined) {
          throw fastify.httpErrors.badRequest('Either baseTokenAmount or quoteTokenAmount must be provided.');
        }

        const sui = await Sui.getInstance(network);
        const keypair = await sui.getWallet(walletAddress);
        const bluefin = Bluefin.getInstance(network);
        const onChain = bluefin.onChain(keypair);

        const position = await bluefin.query.getPositionDetails(positionAddress);
        const pool = await getPool(position.pool_id, network);

        const amountABN = baseTokenAmount ? new BN(toBigNumberStr(baseTokenAmount, pool.coin_a.decimals)) : new BN(0);
        const amountBBN = quoteTokenAmount ? new BN(toBigNumberStr(quoteTokenAmount, pool.coin_b.decimals)) : new BN(0);

        const curSqrtPrice = new BN(pool.current_sqrt_price);

        const liquidityAmount = ClmmPoolUtil.estimateLiquidityFromCoinAmounts(
          curSqrtPrice,
          position.lower_tick,
          position.upper_tick,
          { coinA: amountABN, coinB: amountBBN },
        );

        const lowerSqrtPriceBN = TickMath.tickIndexToSqrtPriceX64(position.lower_tick);
        const upperSqrtPriceBN = TickMath.tickIndexToSqrtPriceX64(position.upper_tick);
        const coinAmounts = ClmmPoolUtil.getCoinAmountFromLiquidity(
          liquidityAmount,
          curSqrtPrice,
          lowerSqrtPriceBN,
          upperSqrtPriceBN,
          true,
        );

        const liquidityParams: ILiquidityParams = {
          lowerPrice: TickMath.tickIndexToPrice(
            position.lower_tick,
            pool.coin_a.decimals,
            pool.coin_b.decimals,
          ).toNumber(),
          upperPrice: TickMath.tickIndexToPrice(
            position.upper_tick,
            pool.coin_a.decimals,
            pool.coin_b.decimals,
          ).toNumber(),
          lowerPriceX64: lowerSqrtPriceBN,
          upperPriceX64: upperSqrtPriceBN,
          lowerTick: position.lower_tick,
          upperTick: position.upper_tick,
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

        const tx = await onChain.provideLiquidity(pool, positionAddress, liquidityParams);
        const txResponse = tx as SuiTransactionBlockResponse;

        if (txResponse.effects?.status.status === 'success') {
          const txDetails = await sui.getTransactionBlock(txResponse.digest);

          const fee = new Decimal(txDetails.effects.gasUsed.computationCost)
            .add(txDetails.effects.gasUsed.storageCost)
            .sub(txDetails.effects.gasUsed.storageRebate)
            .div(1e9)
            .toNumber();

          const liquidityProvidedEvent = txDetails.events.find((e) => e.type.endsWith('::events::LiquidityProvided'))
            ?.parsedJson as any;

          reply.send({
            signature: txResponse.digest,
            status: 1, // CONFIRMED
            data: {
              fee: fee,
              baseTokenAmountAdded: new Decimal(liquidityProvidedEvent.coin_a_amount)
                .div(10 ** pool.coin_a.decimals)
                .toNumber(),
              quoteTokenAmountAdded: new Decimal(liquidityProvidedEvent.coin_b_amount)
                .div(10 ** pool.coin_b.decimals)
                .toNumber(),
            },
          });
        } else if (txResponse.effects?.status.status === 'failure') {
          logger.error(`Add liquidity failed for position ${positionAddress}: ${txResponse.effects.status.error}`);
          throw fastify.httpErrors.internalServerError(
            `Transaction to add liquidity failed: ${txResponse.effects.status.error}`,
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
