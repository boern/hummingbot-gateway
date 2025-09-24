import { FastifyPluginAsync, FastifyInstance } from 'fastify';

import { PollRequestType, PollResponseType, PollResponseSchema } from '../../../schemas/chain-schema';
import { logger } from '../../../services/logger';
import { SuiPollRequest } from '../schemas';
import { Sui } from '../sui';

export async function pollSuiTransaction(
  _fastify: FastifyInstance,
  network: string,
  signature: string,
  _tokens?: string[],
  _walletAddress?: string,
): Promise<PollResponseType> {
  const sui = await Sui.getInstance(network);
  logger.info(`[Sui] Received /poll request for signature ${signature} on ${network}`);

  try {
    const currentBlock = await sui.getCurrentBlockNumber();
    const txData = await sui.getTransactionBlock(signature);

    if (!txData) {
      logger.warn(`[Sui] Transaction ${signature} not found yet. Returning PENDING.`);
      return {
        currentBlock,
        signature,
        txBlock: null,
        txStatus: 0, // PENDING
        txData: null,
        fee: null,
      };
    }

    // TODO: Implement tokenBalanceChanges extraction

    const txStatus = sui.getTransactionStatusCode(txData);
    logger.info(`[Sui] Transaction ${signature}  status: ${txStatus}. `);

    if (txStatus === 1) {
      // CONFIRMED
      const fee = sui.getFee(txData);
      return {
        currentBlock,
        signature,
        txBlock: txData.checkpoint ? parseInt(txData.checkpoint, 10) : null,
        txStatus,
        fee,
        txData,
      };
    } else if (txStatus === -1) {
      // FAILED
      return {
        currentBlock,
        signature,
        txBlock: txData.checkpoint ? parseInt(txData.checkpoint, 10) : null,
        txStatus,
        fee: sui.getFee(txData),
        txData,
        error: txData.effects?.status.error,
      };
    } else {
      // PENDING
      return {
        currentBlock,
        signature,
        txBlock: txData.checkpoint ? parseInt(txData.checkpoint, 10) : null,
        txStatus,
        fee: null,
        txData,
      };
    }
  } catch (error) {
    logger.error(`[Sui] Error polling transaction ${signature}: ${error.message}`);
    return {
      currentBlock: await sui.getCurrentBlockNumber(),
      signature,
      txBlock: null,
      txStatus: -1, // FAILED
      txData: null,
      fee: null,
      error: 'Transaction not found or invalid',
    };
  }
}

export const pollRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: PollRequestType;
    Reply: PollResponseType;
  }>(
    '/poll',
    {
      schema: {
        description: 'Poll for the status of a Sui transaction',
        tags: ['/chain/sui'],
        body: SuiPollRequest,
        response: {
          200: PollResponseSchema,
        },
      },
    },
    async (request) => {
      const { network, signature, tokens, walletAddress } = request.body;
      return await pollSuiTransaction(fastify, network, signature, tokens, walletAddress);
    },
  );
};

export default pollRoute;
