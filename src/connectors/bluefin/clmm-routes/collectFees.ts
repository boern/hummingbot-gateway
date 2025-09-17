import { SuiTransactionBlockResponse } from '@mysten/sui/client';
import { FastifyInstance, FastifyRequest } from 'fastify';

import { Sui } from '../../../chains/sui/sui';
import { CollectFeesResponse } from '../../../schemas/clmm-schema';
import { logger } from '../../../services/logger';
import { Bluefin } from '../bluefin';
import { BluefinCLMMCollectFeesRequest } from '../schemas';

import { getPool } from './poolInfo';

export const collectFeesRoute = async (fastify: FastifyInstance) => {
  fastify.post(
    '/collect-fees',
    {
      schema: {
        description: 'Collect fees from an existing Bluefin CLMM position',
        tags: ['/connector/bluefin'],
        body: BluefinCLMMCollectFeesRequest,
        response: {
          200: CollectFeesResponse,
        },
      },
    },
    async (req: FastifyRequest<{ Body: BluefinCLMMCollectFeesRequest }>, reply) => {
      try {
        const { network = 'mainnet', walletAddress, positionId, slippage = 0.5 } = req.body;

        const bluefin = Bluefin.getInstance(network);
        const onChain = bluefin.onChain;

        const position = await bluefin.query.getPositionDetails(positionId);
        const pool = await getPool(position.pool_id, network);

        const sui = Sui.getInstance(network);
        const keypair = (sui as any).getWallet(walletAddress).keypair;
        onChain.signerConfig.signer = keypair;

        const tx = await onChain.collectFee(pool, positionId);

        // We need to fetch the position again to get the updated fees.
        const updatedPosition = await bluefin.query.getPositionDetails(positionId);

        reply.send({
          txHash: (tx as SuiTransactionBlockResponse).digest,
          positionId: positionId,
          fee0: updatedPosition.token_a_fee,
          fee1: updatedPosition.token_b_fee,
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
