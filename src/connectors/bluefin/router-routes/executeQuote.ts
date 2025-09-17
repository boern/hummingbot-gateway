import { toBigNumber } from '@firefly-exchange/library-sui';
import { ISwapParams } from '@firefly-exchange/library-sui/spot';
import { SuiTransactionBlockResponse } from '@mysten/sui/client';
import { FastifyInstance, FastifyRequest } from 'fastify';

import { Sui } from '../../../chains/sui/sui';
import { SwapExecuteResponse } from '../../../schemas/router-schema';
import { logger } from '../../../services/logger';
import { Bluefin } from '../bluefin';
import { getPool } from '../clmm-routes/poolInfo';
import { BluefinRouterExecuteQuoteRequest } from '../schemas';

export const executeQuoteRoute = async (fastify: FastifyInstance) => {
  fastify.post(
    '/execute-quote',
    {
      schema: {
        description: 'Execute a pre-fetched swap quote on Bluefin router',
        tags: ['/connector/bluefin'],
        body: BluefinRouterExecuteQuoteRequest,
        response: {
          200: SwapExecuteResponse,
        },
      },
    },
    async (req: FastifyRequest<{ Body: BluefinRouterExecuteQuoteRequest }>, reply) => {
      try {
        const { network = 'mainnet', walletAddress, poolAddress, tokenIn, tokenOut, amount, slippage = 0.5 } = req.body;

        const bluefin = Bluefin.getInstance(network);
        const onChain = bluefin.onChain;

        const pool = await getPool(poolAddress, network);

        const aToB = tokenIn === pool.coin_a.address && tokenOut === pool.coin_b.address;

        if (!aToB && (tokenIn !== pool.coin_b.address || tokenOut !== pool.coin_a.address)) {
          throw fastify.httpErrors.badRequest('Invalid token pair for the given pool.');
        }

        const inputDecimals = aToB ? pool.coin_a.decimals : pool.coin_b.decimals;

        const swapParams: ISwapParams = {
          pool: pool,
          amountIn: toBigNumber(Number(amount), inputDecimals),
          amountOut: 0, // amountOut is calculated by the SDK
          aToB: aToB,
          byAmountIn: true,
          slippage: slippage,
        };

        const sui = await Sui.getInstance(network);
        const keypair = (sui as any).getWallet(walletAddress).keypair;
        onChain.signerConfig.signer = keypair;

        const tx = await onChain.swapAssets(swapParams);

        if ('digest' in tx) {
          reply.send({
            txHash: (tx as SuiTransactionBlockResponse).digest,
          });
        } else {
          throw new Error('Transaction execution did not return a digest.');
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
