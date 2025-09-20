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
        if (!position) {
          throw fastify.httpErrors.notFound(`Position with ID ${positionAddress} not found.`);
        }

        return await toGatewayPosition(position, network);
      } catch (e) {
        logger.error(e);
        throw fastify.httpErrors.internalServerError('Failed to fetch position info');
      }
    },
  );
};
