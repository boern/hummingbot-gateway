import { ClmmPoolUtil, TickMath } from '@firefly-exchange/library-sui';
import { SuiTransactionBlockResponse } from '@mysten/sui/client';
import { BN } from 'bn.js';
import Decimal from 'decimal.js';
import { FastifyInstance, FastifyRequest } from 'fastify';

import { Sui } from '../../../chains/sui/sui';
import { ClosePositionResponse } from '../../../schemas/clmm-schema';
import { logger } from '../../../services/logger';
import { Bluefin } from '../bluefin';
import { BluefinCLMMClosePositionRequest } from '../schemas';

export const closePositionRoute = async (fastify: FastifyInstance) => {
  fastify.post(
    '/close-position',
    {
      schema: {
        description: 'Close an existing Bluefin CLMM position',
        tags: ['/connector/bluefin'],
        body: BluefinCLMMClosePositionRequest,
        response: {
          200: ClosePositionResponse,
        },
      },
    },
    async (req: FastifyRequest<{ Body: BluefinCLMMClosePositionRequest }>, reply) => {
      try {
        const { network = 'mainnet', walletAddress, positionAddress } = req.body;
        const sui = await Sui.getInstance(network);
        const keypair = await sui.getWallet(walletAddress);
        const bluefin = Bluefin.getInstance(network);
        const onChain = bluefin.onChain(keypair);

        // First, get position details to find the pool it belongs to.
        const position = await bluefin.query.getPositionDetails(positionAddress);
        if (!position) {
          throw fastify.httpErrors.notFound(`Position with ID ${positionAddress} not found.`);
        }

        // Now get the pool using the pool_id from the position.
        const pool = await onChain.queryChain.getPool(position.pool_id);

        // 1. Get amounts from position liquidity before closing
        const lowerSqrtPrice = TickMath.tickIndexToSqrtPriceX64(position.lower_tick);
        const upperSqrtPrice = TickMath.tickIndexToSqrtPriceX64(position.upper_tick);
        const coinAmounts = ClmmPoolUtil.getCoinAmountFromLiquidity(
          new BN(position.liquidity),
          new BN(pool.current_sqrt_price),
          lowerSqrtPrice,
          upperSqrtPrice,
          false,
        );
        const baseTokenAmountRemoved = new Decimal(coinAmounts.coinA.toString())
          .div(10 ** pool.coin_a.decimals)
          .toNumber();
        const quoteTokenAmountRemoved = new Decimal(coinAmounts.coinB.toString())
          .div(10 ** pool.coin_b.decimals)
          .toNumber();

        // 2. Get accrued fees before collecting them
        const accruedFees = await onChain.getAccruedFeeAndRewards(pool, positionAddress);
        const baseFeeAmountCollected = new Decimal(accruedFees.fee.coinA.toString())
          .div(10 ** pool.coin_a.decimals)
          .toNumber();
        const quoteFeeAmountCollected = new Decimal(accruedFees.fee.coinB.toString())
          .div(10 ** pool.coin_b.decimals)
          .toNumber();

        // This call will remove liquidity, collect fees, and close the position account.
        const tx = await onChain.closePosition(pool, positionAddress);

        const txResponse = tx as SuiTransactionBlockResponse;

        if (txResponse.effects?.status.status === 'success') {
          const txDetails = await sui.getTransactionBlock(txResponse.digest);

          const fee = new Decimal(txDetails.effects.gasUsed.computationCost)
            .add(txDetails.effects.gasUsed.storageCost)
            .sub(txDetails.effects.gasUsed.storageRebate)
            .div(1e9)
            .toNumber();

          const rentRefunded = new Decimal(txDetails.effects.gasUsed.storageRebate).div(1e9).toNumber();

          reply.send({
            signature: txResponse.digest,
            status: 1, // CONFIRMED
            data: {
              fee: fee,
              positionRentRefunded: rentRefunded,
              baseTokenAmountRemoved: baseTokenAmountRemoved,
              quoteTokenAmountRemoved: quoteTokenAmountRemoved,
              baseFeeAmountCollected: baseFeeAmountCollected,
              quoteFeeAmountCollected: quoteFeeAmountCollected,
            },
          });
        } else if (txResponse.effects?.status.status === 'failure') {
          logger.error(`Close position failed for position ${positionAddress}: ${txResponse.effects.status.error}`);
          throw fastify.httpErrors.internalServerError(
            `Transaction to close position failed: ${txResponse.effects.status.error}`,
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
