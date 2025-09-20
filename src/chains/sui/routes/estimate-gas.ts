import { FastifyPluginAsync, FastifyInstance } from 'fastify';

import { EstimateGasRequestType, EstimateGasResponse, EstimateGasResponseSchema } from '../../../schemas/chain-schema';
import { logger } from '../../../services/logger';
import { SuiEstimateGasRequest } from '../schemas';
import { Sui } from '../sui';

const DEFAULT_COMPUTE_UNITS = 10000000; // A reasonable default gas budget for a typical transaction

export async function estimateGasSui(fastify: FastifyInstance, network: string): Promise<EstimateGasResponse> {
  try {
    const sui = await Sui.getInstance(network);
    const gasPrice = await sui.getReferenceGasPrice();

    const fee = Number(gasPrice) * DEFAULT_COMPUTE_UNITS;
    // Convert MIST to SUI（1 SUI = 10^9 MIST）
    const feeInSui = fee / 1e9; // Convert MIST to SUI

    return {
      feePerComputeUnit: Number(gasPrice),
      denomination: 'MIST',
      computeUnits: DEFAULT_COMPUTE_UNITS,
      feeAsset: sui.nativeTokenSymbol,
      fee: feeInSui,
      timestamp: Date.now(),
    };
  } catch (error) {
    logger.error(`Error estimating gas for network ${network}: ${error.message}`);
    throw fastify.httpErrors.internalServerError(`Failed to estimate gas for network ${network}: ${error.message}`);
  }
}

export const estimateGasRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: EstimateGasRequestType;
    Reply: EstimateGasResponse;
  }>(
    '/estimate-gas',
    {
      schema: {
        description: 'Estimate gas prices for Sui transactions',
        tags: ['/chain/sui'],
        querystring: SuiEstimateGasRequest,
        response: {
          200: EstimateGasResponseSchema,
        },
      },
    },
    async (request) => {
      const { network } = request.query;
      return await estimateGasSui(fastify, network);
    },
  );
};

export default estimateGasRoute;
