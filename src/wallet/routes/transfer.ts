import { FastifyPluginAsync } from 'fastify';

import { TransferRequest, TransferRequestSchema, TransferResponse, TransferResponseSchema } from '../schemas';
import { transfer } from '../utils';

export const transferRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: TransferRequest;
    Reply: TransferResponse;
  }>(
    '/transfer',
    {
      schema: {
        summary: 'Transfer tokens from a gateway wallet',
        description:
          'Transfers a specified amount of a token from a managed wallet to a destination address. The sending wallet must exist in the gateway.',
        tags: ['/wallet'],
        body: TransferRequestSchema,
        response: {
          200: TransferResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const response = await transfer(fastify, request.body);
      reply.send(response);
    },
  );
};
