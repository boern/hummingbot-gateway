import { FastifyInstance, FastifyRequest } from 'fastify';

import { PositionInfo, PositionInfoSchema } from '../../../schemas/clmm-schema';
import { logger } from '../../../services/logger';
import { Bluefin } from '../bluefin';
import { BluefinCLMMGetPositionInfoRequest } from '../schemas';

import { toGatewayPosition } from './positionsOwned';

export const positionInfoRoute = async (fastify: FastifyInstance) => {
  fastify.get(
    '/position-info',
    {
      schema: {
        description: 'Get info about a Bluefin CLMM position',
        tags: ['/connector/bluefin'],
        querystring: BluefinCLMMGetPositionInfoRequest,
        response: {
          200: PositionInfoSchema,
        },
      },
    },
    async (
      req: FastifyRequest<{ Querystring: typeof BluefinCLMMGetPositionInfoRequest.static }>,
    ): Promise<PositionInfo> => {
      try {
        const { network = 'mainnet', positionAddress } = req.query;
        const bluefin = Bluefin.getInstance(network);

        const position = await bluefin.query.getPositionDetails(positionAddress);
        logger.info(
          `[Bluefin] fetched position info for position address ${req.query.positionAddress}: ${JSON.stringify(position, null, 2)}`,
        );
        if (!position) {
          throw fastify.httpErrors.notFound(`Position with ID ${positionAddress} not found.`);
        }
        return await toGatewayPosition(position, network);
      } catch (error) {
        logger.error(
          `Error fetching position info for position address ${req.query.positionAddress}: ${error.message}`,
        );
        // Re-throw the error to ensure it's not swallowed and the client receives an appropriate response.
        throw fastify.httpErrors.internalServerError(
          `Failed to fetch position info for position address ${req.query.positionAddress},error: ${error.message}`,
        );
      }
    },
  );
};
