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
        logger.info(`[Bluefin] Received /close-position request: ${JSON.stringify(req.body)}`);

        const sui = await Sui.getInstance(network);
        const keypair = await sui.getWallet(walletAddress);
        const bluefin = Bluefin.getInstance(network);
        const onChain = bluefin.onChain(keypair);

        // 1. Get position details to find the pool it belongs to.
        const position = await bluefin.query.getPositionDetails(positionAddress);
        logger.info(`[Bluefin] Fetched position details for closing: ${JSON.stringify(position)}`);
        if (!position) {
          throw fastify.httpErrors.notFound(`Position with ID ${positionAddress} not found.`);
        }

        // Now get the pool using the pool_id from the position.
        const pool = await onChain.queryChain.getPool(position.pool_id);
        logger.info(`[Bluefin] Fetched pool data for closing: ${pool.id}`);

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

        // 2. Get accrued fees and rewards before collecting them
        const accruedFees = await onChain.getAccruedFeeAndRewards(pool, positionAddress);
        logger.info(`[Bluefin] Fetched accrued fees for closing: ${JSON.stringify(accruedFees)}`);

        // 3. Use a map to collect and merge fees and rewards by full address
        const combined = new Map<string, Decimal>();

        // Process fees
        const feeTokens = [
          { token: pool.coin_a, amount: accruedFees.fee.coinA },
          { token: pool.coin_b, amount: accruedFees.fee.coinB },
        ];

        for (const { token, amount } of feeTokens) {
          const currentAmount = combined.get(token.address) || new Decimal(0);
          combined.set(token.address, currentAmount.add(new Decimal(amount.toString()).div(10 ** token.decimals)));
        }

        // Process rewards
        accruedFees.rewards.forEach((reward) => {
          // Ensure reward address has '0x' prefix
          const fullAddress = reward.coinType.startsWith('0x') ? reward.coinType : `0x${reward.coinType}`;
          const currentAmount = combined.get(fullAddress) || new Decimal(0);
          combined.set(fullAddress, currentAmount.add(new Decimal(reward.coinAmount).div(10 ** reward.coinDecimals)));
        });

        const baseFeeAmountCollected = combined.get(pool.coin_a.address)?.toNumber() || 0;
        const quoteFeeAmountCollected = combined.get(pool.coin_b.address)?.toNumber() || 0;

        // 4. This call will remove liquidity, collect fees, and close the position account.
        const tx = await onChain.closePosition(pool, positionAddress);

        const txResponse = tx as SuiTransactionBlockResponse;
        logger.info(`[Bluefin] closePosition transaction response: ${JSON.stringify(txResponse)}`);

        if (txResponse.effects?.status.status === 'success') {
          // const txDetails = await sui.getTransactionBlock(txResponse.digest);

          const fee = new Decimal(txResponse.effects.gasUsed.computationCost)
            .add(txResponse.effects.gasUsed.storageCost)
            .sub(txResponse.effects.gasUsed.storageRebate)
            .div(1e9)
            .toNumber();

          const rentRefunded = new Decimal(txResponse.effects.gasUsed.storageRebate).div(1e9).toNumber();

          const response = {
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
          };
          logger.info(`[Bluefin] Close position successful. Response: ${JSON.stringify(response)}`);
          reply.send(response);
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
          logger.info(
            `[Bluefin] Close position transaction has no effects yet. Digest: ${txResponse.digest}. Returning PENDING.`,
          );
        }
      } catch (e) {
        if (e instanceof Error) {
          logger.error(`[Bluefin] Error in /close-position: ${e}`);
          throw fastify.httpErrors.internalServerError(e.message);
        }

        throw e;
      }
    },
  );
};
