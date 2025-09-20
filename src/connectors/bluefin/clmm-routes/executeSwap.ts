import { toBigNumber } from '@firefly-exchange/library-sui';
import { ISwapParams, parsePool } from '@firefly-exchange/library-sui/spot';
import { SuiTransactionBlockResponse } from '@mysten/sui/client';
import Decimal from 'decimal.js';
import { FastifyInstance, FastifyRequest } from 'fastify';

import { Sui } from '../../../chains/sui/sui';
import { ExecuteSwapResponse, ExecuteSwapResponseType } from '../../../schemas/clmm-schema';
import { logger } from '../../../services/logger';
import { Bluefin } from '../bluefin';
import { BluefinRouterExecuteSwapRequest } from '../schemas';

import { getPool } from './poolInfo';

export const executeSwapRoute = async (fastify: FastifyInstance) => {
  fastify.post(
    '/execute-swap',
    {
      schema: {
        description: 'Execute a swap on Bluefin router',
        tags: ['/connector/bluefin'],
        body: BluefinRouterExecuteSwapRequest,
        response: {
          200: ExecuteSwapResponse,
        },
      },
    },
    async (
      req: FastifyRequest<{ Body: BluefinRouterExecuteSwapRequest; Reply: ExecuteSwapResponseType }>,
    ): Promise<ExecuteSwapResponseType> => {
      try {
        const {
          network = 'mainnet',
          walletAddress,
          poolAddress,
          baseToken,
          quoteToken,
          amount,
          side,
          slippagePct: slippage = 0.5,
        } = req.body;

        logger.info(`[Bluefin] Received /execute-swap request: ${JSON.stringify(req.body)}`);
        const bluefin = Bluefin.getInstance(network);
        const sui = await Sui.getInstance(network);
        const keypair = await sui.getWallet(walletAddress);
        const onChain = bluefin.onChain(keypair);

        const pool = await getPool(poolAddress, network);
        const poolMeta = parsePool(pool);
        logger.info(`[Bluefin] Fetched pool meta for ${JSON.stringify(poolMeta)}`);
        // Determine swap direction and tokens
        const isSell = side === 'SELL';
        const tokenIn = isSell ? baseToken : (quoteToken as string);
        const tokenOut = isSell ? (quoteToken as string) : baseToken;

        // The coinA/coinB from poolMeta are full addresses like '0x...::wal::WAL'
        // We should check if the provided token symbol is part of the address string.
        const aToB = poolMeta.coinA.includes(`::${tokenIn.toLowerCase()}::${tokenIn.toUpperCase()}`);
        if (!aToB && (tokenIn !== poolMeta.coinB || tokenOut !== poolMeta.coinA)) {
          throw fastify.httpErrors.badRequest('Invalid token pair for the given pool.');
        }

        const inputDecimals = aToB ? poolMeta.coinADecimals : poolMeta.coinBDecimals;
        const outputDecimals = aToB ? poolMeta.coinBDecimals : poolMeta.coinADecimals;
        const amountInBigNumber = toBigNumber(amount, inputDecimals);

        const swapParams: ISwapParams = {
          pool: pool,
          amountIn: amountInBigNumber,
          amountOut: 0, // amountOut is calculated by the SDK
          aToB: aToB,
          byAmountIn: true,
          slippage: slippage,
        };

        logger.info(`[Bluefin] Calling onChain.swapAssets with params: ${JSON.stringify(swapParams)}`);
        const tx = (await onChain.swapAssets(swapParams)) as SuiTransactionBlockResponse;

        if (tx.effects?.status.status === 'success') {
          const fee = new Decimal(tx.effects.gasUsed.computationCost)
            .add(tx.effects.gasUsed.storageCost)
            .sub(tx.effects.gasUsed.storageRebate)
            .div(1e9)
            .toNumber();

          const swapEvent = tx.events?.find((e) => e.type.endsWith('::events::AssetSwap'))?.parsedJson as any;

          if (!swapEvent) {
            throw fastify.httpErrors.internalServerError('Swap event not found in successful transaction');
          }

          const amountIn = new Decimal(swapEvent.amount_in).div(10 ** inputDecimals).toNumber();
          const amountOut = new Decimal(swapEvent.amount_out).div(10 ** outputDecimals).toNumber();

          const response = {
            signature: tx.digest,
            status: 1, // CONFIRMED
            data: {
              tokenIn: tokenIn,
              tokenOut: tokenOut,
              amountIn: amountIn,
              amountOut: amountOut,
              fee: fee,
              baseTokenBalanceChange: isSell ? -amountIn : amountOut,
              quoteTokenBalanceChange: isSell ? amountOut : -amountIn,
            },
          };

          logger.info(`[Bluefin] Execute swap response: ${JSON.stringify(response)}`);

          return response;
        } else if (tx.effects?.status.status === 'failure') {
          logger.error(`Execute swap transaction failed: ${tx.effects.status.error}`);
          throw fastify.httpErrors.internalServerError(
            `Transaction to execute swap failed: ${tx.effects.status.error}`,
          );
        } else {
          // If there are no effects, the transaction is likely still processing.
          logger.info(`[Bluefin] Swap transaction has no effects yet. Digest: ${tx.digest}. Returning PENDING.`);
          return { signature: tx.digest, status: 0 }; // PENDING
        }
      } catch (e) {
        if (e.statusCode) {
          throw e;
        }
        if (e instanceof Error) {
          logger.error(e.message);
          throw fastify.httpErrors.internalServerError(e.message);
        }
        throw e;
      }
    },
  );
};
