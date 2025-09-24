import { FastifyPluginAsync, FastifyInstance } from 'fastify';

import { BalanceRequestType, BalanceResponseType, BalanceResponseSchema } from '../../../schemas/chain-schema';
import { logger } from '../../../services/logger';
import { SuiBalanceRequest } from '../schemas';
import { Sui } from '../sui';

/**
 * Main entry point for getting Sui balances
 */
export async function getSuiBalances(
  fastify: FastifyInstance,
  network: string,
  address: string,
  tokens?: string[],
  fetchAll?: boolean,
): Promise<BalanceResponseType> {
  try {
    logger.info(
      `[Sui] Received /balances request for ${address} on ${network}. Tokens: ${tokens}, FetchAll: ${fetchAll}`,
    );
    const sui = await Sui.getInstance(network);
    const balances = await sui.getBalances(address, tokens, fetchAll);
    logger.info(`[Sui] Found balances for ${address}: ${JSON.stringify(balances)}`);
    return { balances };
  } catch (error) {
    logger.error(`Error getting balances: ${error.message}`);
    throw fastify.httpErrors.internalServerError(`Failed to get balances: ${error.message}`);
  }
}

export const balancesRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: BalanceRequestType;
    Reply: BalanceResponseType;
  }>(
    '/balances',
    {
      schema: {
        description:
          'Get token balances for a Sui address. If no tokens specified or empty array provided, returns non-zero balances for tokens from the token list that are found in the wallet (includes SUI even if zero). If specific tokens are requested, returns those exact tokens with their balances, including zeros.',
        tags: ['/chain/sui'],
        body: SuiBalanceRequest,
        response: {
          200: {
            ...BalanceResponseSchema,
            description: 'Token balances for the specified address',
            examples: [
              {
                balances: {
                  SUI: 1.5,
                  USDC: 100.0,
                },
              },
            ],
          },
        },
      },
    },
    async (request) => {
      const { network, address, tokens, fetchAll } = request.body;
      return await getSuiBalances(fastify, network, address, tokens, fetchAll);
    },
  );
};

export default balancesRoute;
