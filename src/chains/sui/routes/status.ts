import { FastifyPluginAsync, FastifyInstance } from 'fastify';

import { StatusRequestType, StatusResponseType, StatusResponseSchema } from '../../../schemas/chain-schema';
import { logger } from '../../../services/logger';
import { SuiStatusRequest } from '../schemas';
import { Sui } from '../sui';

export async function getSuiStatus(fastify: FastifyInstance, network: string): Promise<StatusResponseType> {
  try {
    logger.info(`[Sui] Received /status request for network: ${network}`);
    const sui = await Sui.getInstance(network);
    const chain = 'sui';
    const rpcUrl = sui.rpcUrl;
    const nativeCurrency = sui.nativeTokenSymbol;
    const currentBlockNumber = await sui.getCurrentBlockNumber();

    const response = {
      chain,
      network,
      rpcUrl,
      currentBlockNumber,
      nativeCurrency,
    };
    logger.info(`[Sui] Responding to /status request: ${JSON.stringify(response)}`);
    return response;
  } catch (error) {
    logger.error(`Error getting Sui status: ${error.message}`);
    throw fastify.httpErrors.internalServerError(`Failed to get Sui status: ${error.message}`);
  }
}

export const statusRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: StatusRequestType;
    Reply: StatusResponseType;
  }>(
    '/status',
    {
      schema: {
        description: 'Get Sui network status',
        tags: ['/chain/sui'],
        querystring: SuiStatusRequest,
        response: {
          200: StatusResponseSchema,
        },
      },
    },
    async (request) => {
      const { network } = request.query;
      return await getSuiStatus(fastify, network);
    },
  );
};

export default statusRoute;
