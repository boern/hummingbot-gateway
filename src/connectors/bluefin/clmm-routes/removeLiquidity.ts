import { ClmmPoolUtil, TickMath } from '@firefly-exchange/library-sui';
import { LiquidityInput } from '@firefly-exchange/library-sui/';
import { SuiTransactionBlockResponse } from '@mysten/sui/client';
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
        const { network = 'mainnet', walletAddress, positionAddress, percentageToRemove } = req.body;
        logger.info(`[Bluefin] Received /remove-liquidity request: ${JSON.stringify(req.body)}`);

        if (percentageToRemove <= 0 || percentageToRemove > 100) {
          throw fastify.httpErrors.badRequest('Invalid percentageToRemove - must be between 0 and 100.');
        }

        const bluefin = Bluefin.getInstance(network);
        const sui = await Sui.getInstance(network);
        const keypair = await sui.getWallet(walletAddress);
        const onChain = bluefin.onChain(keypair);

        const position = await bluefin.query.getPositionDetails(positionAddress);
        logger.info(`[Bluefin] Fetched position details: ${JSON.stringify(position)}`);
        if (!position) {
          throw fastify.httpErrors.notFound(`Position with ID ${positionAddress} not found.`);
        }
        if (new BN(position.liquidity).isZero()) {
          throw fastify.httpErrors.badRequest('Position has zero liquidity - nothing to remove.');
        }
        logger.info(`[Bluefin] Position has liquidity, proceeding with removal.`);

        const pool = await getPool(position.pool_id, network);
        logger.info(`[Bluefin] Fetched pool data: ${pool.id}`);

        const liquidityToRemove = new Decimal(position.liquidity).mul(percentageToRemove / 100).toDP(0);

        const lowerSqrtPriceBN = TickMath.tickIndexToSqrtPriceX64(position.lower_tick);
        const upperSqrtPriceBN = TickMath.tickIndexToSqrtPriceX64(position.upper_tick);
        const curSqrtPrice = new BN(pool.current_sqrt_price);

        const coinAmounts = ClmmPoolUtil.getCoinAmountFromLiquidity(
          new BN(liquidityToRemove.toString()),
          curSqrtPrice,
          lowerSqrtPriceBN,
          upperSqrtPriceBN,
          false, // roundUp is false for removing liquidity
        );

        // Construct the correct LiquidityInput object for the SDK.
        const liquidityInput: LiquidityInput = {
          liquidityAmount: new BN(liquidityToRemove.toString()),
          coinAmountA: coinAmounts.coinA,
          coinAmountB: coinAmounts.coinB,
          // For removing liquidity, we don't need to specify a fixed amount of one coin.
          // The amounts are derived from the liquidity being removed.
          coinAmount: new BN(0),
          tokenMaxA: coinAmounts.coinA, // Set to the expected amount as we don't have slippage from the request.
          tokenMaxB: coinAmounts.coinB, // Set to the expected amount.
          fix_amount_a: false, // Not relevant when removing liquidity by percentage.
        };
        logger.info(`[Bluefin] Calling onChain.removeLiquidity with params: ${JSON.stringify(liquidityInput)}`);
        const tx = await onChain.removeLiquidity(pool, positionAddress, liquidityInput);
        const txResponse = tx as SuiTransactionBlockResponse;
        logger.info(`[Bluefin] removeLiquidity transaction response: ${JSON.stringify(txResponse)}`);

        if (txResponse.effects?.status.status === 'success') {
          // const txDetails = await sui.getTransactionBlock(txResponse.digest);
          const fee = new Decimal(txResponse.effects.gasUsed.computationCost)
            .add(txResponse.effects.gasUsed.storageCost)
            .sub(txResponse.effects.gasUsed.storageRebate)
            .div(1e9)
            .toNumber();

          const response = {
            signature: txResponse.digest,
            status: 1, // CONFIRMED
            data: {
              fee: fee,
              baseTokenAmountRemoved: new Decimal(coinAmounts.coinA.toString())
                .div(10 ** pool.coin_a.decimals)
                .toNumber(),
              quoteTokenAmountRemoved: new Decimal(coinAmounts.coinB.toString())
                .div(10 ** pool.coin_b.decimals)
                .toNumber(),
            },
          };
          logger.info(`[Bluefin] Remove liquidity successful. Response: ${JSON.stringify(response)}`);
          reply.send(response);
        } else if (txResponse.effects?.status.status === 'failure') {
          logger.error(`Remove liquidity failed for position ${positionAddress}: ${txResponse.effects.status.error}`);
          throw fastify.httpErrors.internalServerError(
            `Transaction to remove liquidity failed: ${txResponse.effects.status.error}`,
          );
        } else {
          const response = { signature: txResponse.digest, status: 0 }; // PENDING
          logger.info(
            `[Bluefin] Remove liquidity transaction has no effects yet. Digest: ${txResponse.digest}. Returning PENDING.`,
          );
          reply.send(response);
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
