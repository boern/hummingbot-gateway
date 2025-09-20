import { SuiTransactionBlockResponse } from '@mysten/sui/client';
import Decimal from 'decimal.js';
import { FastifyInstance } from 'fastify';

import { Sui } from '../../../chains/sui/sui';
import { CollectFeesResponse, CollectFeesRequestType, CollectFeesResponseType } from '../../../schemas/clmm-schema';
import { logger } from '../../../services/logger';
import { Bluefin } from '../bluefin';
import { BluefinCLMMCollectFeesRequest } from '../schemas';

import { getPool } from './poolInfo';

export const collectFeesRoute = async (fastify: FastifyInstance) => {
  fastify.post<{
    Body: CollectFeesRequestType;
    Reply: CollectFeesResponseType;
  }>(
    '/collect-fees',
    {
      schema: {
        description: 'Collect fees from an existing Bluefin CLMM position',
        tags: ['/connector/bluefin'], // This will be replaced by the hook in bluefin.routes.ts
        body: BluefinCLMMCollectFeesRequest,
        response: {
          200: CollectFeesResponse,
        },
      },
    },
    async (req, reply) => {
      try {
        const { network = 'mainnet', walletAddress, positionAddress } = req.body;

        const sui = await Sui.getInstance(network);
        const keypair = await sui.getWallet(walletAddress);
        const bluefin = Bluefin.getInstance(network);
        const onChain = bluefin.onChain(keypair);

        // 1. Get pool and position info
        const positionInfo = await bluefin.query.getPositionDetails(positionAddress);
        if (!positionInfo) {
          throw fastify.httpErrors.notFound(`Position with ID ${positionAddress} not found.`);
        }
        const pool = await getPool(positionInfo.pool_id, network);

        // 2. Get accrued fees before collecting them
        const accruedFees = await onChain.getAccruedFeeAndRewards(pool, positionAddress);
        const baseFeeToCollect = new Decimal(accruedFees.fee.coinA.toString())
          .div(10 ** pool.coin_a.decimals)
          .toNumber();
        const quoteFeeToCollect = new Decimal(accruedFees.fee.coinB.toString())
          .div(10 ** pool.coin_b.decimals)
          .toNumber();

        // 3. Collect fees and rewards
        const txResponse = (await onChain.collectFeeAndRewards(pool, positionAddress)) as SuiTransactionBlockResponse;

        // 4. Process the transaction response
        if (txResponse.effects?.status.status === 'success') {
          const fee = new Decimal(txResponse.effects.gasUsed.computationCost)
            .add(txResponse.effects.gasUsed.storageCost)
            .sub(txResponse.effects.gasUsed.storageRebate)
            .div(1e9)
            .toNumber();

          reply.send({
            signature: txResponse.digest,
            status: 1, // CONFIRMED
            data: {
              fee: fee,
              baseFeeAmountCollected: baseFeeToCollect,
              quoteFeeAmountCollected: quoteFeeToCollect,
            },
          });
        } else if (txResponse.effects?.status.status === 'failure') {
          logger.error(`Fee collection failed for position ${positionAddress}: ${txResponse.effects.status.error}`);
          // Even though it failed, we have a signature.
          // We can return a FAILED status. Hummingbot doesn't have a specific state for this,
          // but we can use a non-CONFIRMED status. Let's use 0 (PENDING) and let it timeout,
          // or a custom status if the client can handle it. For now, we'll throw an error.
          throw fastify.httpErrors.internalServerError(
            `Transaction to collect fees failed: ${txResponse.effects.status.error}`,
          );
        } else {
          // If there are no effects, the transaction is likely still processing.
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
