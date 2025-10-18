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
        // const aToB = poolMeta.coinA.includes(`::${tokenIn.toLowerCase()}::${tokenIn.toUpperCase()}`);
        // if (!aToB && (tokenIn !== poolMeta.coinB || tokenOut !== poolMeta.coinA)) {
        //   throw fastify.httpErrors.badRequest('Invalid token pair for the given pool.');
        // }
        const aToB = isSell;

        if (
          (isSell && !poolMeta.name.includes(`${baseToken}-`)) ||
          (!isSell && !poolMeta.name.includes(`-${quoteToken}`))
        ) {
          throw fastify.httpErrors.badRequest(
            'Invalid token pair for the given pool. Base/Quote do not match pool definition.',
          );
        }

        const byAmountIn = side === 'SELL';
        const inputDecimals = aToB ? poolMeta.coinADecimals : poolMeta.coinBDecimals;
        const outputDecimals = aToB ? poolMeta.coinBDecimals : poolMeta.coinADecimals;
        // const amountInBigNumber = toBigNumber(amount, inputDecimals);
        // When buying (byAmountIn=false), amount is the desired output amount.
        // When selling (byAmountIn=true), amount is the exact input amount.
        // const amountInBigNumber = byAmountIn ? toBigNumber(amount, inputDecimals) : 0;
        // const amountOutBigNumber = byAmountIn ? 0 : toBigNumber(amount, byAmountIn ? outputDecimals : inputDecimals);
        // For BUY side, the 'amount' is for the base token (WAL), which is coinA and the output of the swap.
        // So we need to use its decimals.
        const amountInBigNumber = byAmountIn ? toBigNumber(amount, inputDecimals) : 0;
        const amountOutBigNumber = byAmountIn ? 0 : toBigNumber(amount, outputDecimals);

        let swapParams: ISwapParams;

        if (byAmountIn) {
          // For SELL side (exact amount in), we know the exact amountIn.
          swapParams = {
            pool: pool,
            amountIn: amountInBigNumber,
            amountOut: amountOutBigNumber, // This will be 0
            aToB: aToB,
            byAmountIn: byAmountIn,
            slippage: slippage,
          };
        } else {
          // For BUY side (exact amount out), we need to compute the required amountIn first.
          // The `swapAssets` function for `byAmountIn: false` requires `amountInMax`.
          const quote_swap_params = { pool, amountIn: 0, amountOut: amountOutBigNumber, aToB, byAmountIn, slippage };
          logger.info(`[Bluefin] Calling onChain.computeSwapResults with params: ${JSON.stringify(quote_swap_params)}`);
          const quoteResult = await onChain.computeSwapResults(quote_swap_params);
          logger.info(`[Bluefin] quote-swap quoteResult : ${JSON.stringify(quoteResult, null, 2)}`);
          const quoteEvent = quoteResult.events?.find((e) => e.type.endsWith('::pool::SwapResult'))?.parsedJson as any;
          if (!quoteEvent || !quoteEvent.amount_calculated) {
            throw fastify.httpErrors.internalServerError('Failed to get quote for exact-out swap.');
          }
          const requiredAmountIn = new Decimal(quoteEvent.amount_calculated.toString());
          const amountInMax = requiredAmountIn
            .mul(new Decimal(1).add(new Decimal(slippage).div(100)))
            .floor()
            .toNumber();

          swapParams = {
            pool: pool,
            amountIn: amountInMax, // Use amountInMax for the `amountIn` field when byAmountIn is false
            // amountOut: amountOutBigNumber,
            amountOut: 0,
            aToB: aToB,
            // byAmountIn: byAmountIn,
            byAmountIn: true,
            slippage: slippage,
          };
        }
        logger.info(`[Bluefin] Calling onChain.swapAssets with params: ${JSON.stringify(swapParams)}`);
        const tx = (await onChain.swapAssets(swapParams)) as SuiTransactionBlockResponse;

        if (tx.effects?.status.status === 'success') {
          const fee = new Decimal(tx.effects.gasUsed.computationCost)
            .add(tx.effects.gasUsed.storageCost)
            .sub(tx.effects.gasUsed.storageRebate)
            .div(1e9)
            .toNumber();

          const swapEvent = tx.events?.find((e) => e.type.endsWith('::events::AssetSwap'))?.parsedJson as any;
          logger.info(`[Bluefin] execute-swap swapEventData: ${JSON.stringify(swapEvent, null, 2)}`);

          if (!swapEvent || !swapEvent.amount_in || !swapEvent.amount_out) {
            throw fastify.httpErrors.internalServerError('Swap event not found in successful transaction');
          }

          const amountIn = new Decimal(swapEvent.amount_in.toString()).div(10 ** inputDecimals).toNumber();
          const amountOut = new Decimal(swapEvent.amount_out.toString()).div(10 ** outputDecimals).toNumber();

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
          logger.error(`[Bluefin] Execute swap transaction failed: ${tx.effects.status.error}`);
          throw fastify.httpErrors.internalServerError(
            `Transaction to execute swap failed: ${tx.effects.status.error}`,
          );
        } else {
          // If there are no effects, the transaction is likely still processing.
          logger.info(`[Bluefin] Swap transaction has no effects yet. Digest: ${tx.digest}. Returning PENDING.`);
          return { signature: tx.digest, status: 0 }; // PENDING
        }
      } catch (e) {
        logger.error(`[Bluefin] Execute swap error: ${e.message}`, e);
        if (e instanceof Error) {
          throw fastify.httpErrors.internalServerError(`Execute swap failed: ${e.message}`);
        }
        throw e;
      }
    },
  );
};
