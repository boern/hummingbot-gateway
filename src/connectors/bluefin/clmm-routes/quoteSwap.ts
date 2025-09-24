import { TickMath, toBigNumber } from '@firefly-exchange/library-sui';
import { ISwapParams, parsePool } from '@firefly-exchange/library-sui/spot';
import { SuiTransactionBlockResponse } from '@mysten/sui/client';
import { BN } from 'bn.js';
import Decimal from 'decimal.js';
import { FastifyInstance } from 'fastify';

import { Sui } from '../../../chains/sui/sui';
import { getSuiChainConfig } from '../../../chains/sui/sui.config';
import { QuoteSwapResponseType, QuoteSwapResponse } from '../../../schemas/clmm-schema';
import { logger } from '../../../services/logger';
import { Bluefin } from '../bluefin';

// import { walletAddress } from '../config'}
import { getPool } from '../clmm-routes/poolInfo';
import { BluefinRouterQuoteSwapRequest } from '../schemas';

export const quoteSwapRoute = async (fastify: FastifyInstance) => {
  fastify.get(
    '/quote-swap',
    {
      schema: {
        description: 'Get a swap quote from Bluefin router',
        tags: ['/connector/bluefin'],
        querystring: BluefinRouterQuoteSwapRequest,
        response: {
          // Use the router schema for response
          200: QuoteSwapResponse,
        },
      },
    },
    async (req) => {
      logger.info(`[Bluefin] quote-swap request: ${JSON.stringify(req.query, null, 2)}`);
      try {
        const {
          network = 'mainnet',
          poolAddress,
          baseToken,
          quoteToken,
          amount,
          side, // Type assertion for side
          slippagePct: slippage = 0.5,
        } = req.query as BluefinRouterQuoteSwapRequest;

        // Validate essential parameters
        if (!baseToken || !quoteToken || !amount || !side) {
          throw fastify.httpErrors.badRequest('baseToken, quoteToken, amount, and side are required');
        }

        const bluefin = Bluefin.getInstance(network);
        const sui = await Sui.getInstance(network);
        const sui_chain_config = getSuiChainConfig();
        logger.info(`[Bluefin] sui_chain_config : ${JSON.stringify(sui_chain_config, null, 2)}`);
        const keypair = await sui.getWallet(sui_chain_config.defaultWallet);
        // logger.info(`keypair : ${JSON.stringify(keypair, null, 2)}`);
        const onChain = bluefin.onChain(keypair);
        const pool = await getPool(poolAddress, network);
        const poolMeta = parsePool(pool);
        logger.info(`[Bluefin] poolMeta : ${JSON.stringify(poolMeta, null, 2)}`);
        // Determine swap direction and tokens
        const isSell = side === 'SELL';
        const tokenIn = isSell ? baseToken : (quoteToken as string);
        const tokenOut = isSell ? (quoteToken as string) : baseToken;

        // The coinA/coinB from poolMeta are full addresses like '0x...::wal::WAL'
        // We should check if the provided token symbol is part of the address string.
        // const aToB = poolMeta.coinA.includes(`::${tokenIn.toLowerCase()}::${tokenIn.toUpperCase()}`);
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

        const inputDecimals = isSell ? poolMeta.coinADecimals : poolMeta.coinBDecimals;
        const outputDecimals = isSell ? poolMeta.coinBDecimals : poolMeta.coinADecimals;

        const amountInBigNumber = byAmountIn ? toBigNumber(amount, inputDecimals) : 0;
        const amountOutBigNumber = byAmountIn ? 0 : toBigNumber(amount, outputDecimals);

        const swapParams: ISwapParams = {
          pool: pool,
          amountIn: amountInBigNumber,
          amountOut: amountOutBigNumber,
          aToB: aToB,
          byAmountIn: byAmountIn,
          slippage: slippage,
        };
        logger.info(`[Bluefin] quote-swap swapParams: ${JSON.stringify(swapParams, null, 2)}`);
        const swapResult = await onChain.computeSwapResults(swapParams);
        logger.info(`[Bluefin] quote-swap swapResult : ${JSON.stringify(swapResult, null, 2)}`);
        // The actual swap result is in the `parsedJson` of the SwapResult event
        const swapEventData = swapResult.events?.find((e) => e.type.endsWith('::pool::SwapResult'))?.parsedJson as any;
        logger.info(`[Bluefin] quote-swap swapEventData: ${JSON.stringify(swapEventData, null, 2)}`);

        if (!swapEventData) {
          throw new Error('Could not find SwapResult event in the transaction effects.');
        }

        let amountIn: number;
        let amountOut: number;

        if (byAmountIn) {
          amountIn = new Decimal(swapEventData.amount_specified.toString()).div(10 ** inputDecimals).toNumber();
          amountOut = new Decimal(swapEventData.amount_calculated.toString()).div(10 ** outputDecimals).toNumber();
        } else {
          amountIn = new Decimal(swapEventData.amount_calculated.toString()).div(10 ** inputDecimals).toNumber();
          amountOut = new Decimal(swapEventData.amount_specified.toString()).div(10 ** outputDecimals).toNumber();
        }

        let minAmountOut: number;
        if (byAmountIn) {
          // For exact-in, minAmountOut is calculated from the resulting amountOut minus slippage.
          const minAmountOutBN = new Decimal(swapEventData.amount_calculated.toString())
            .mul(new Decimal(1).minus(new Decimal(slippage).div(100)))
            .floor();
          minAmountOut = new Decimal(minAmountOutBN.toString()).div(10 ** outputDecimals).toNumber();
        } else {
          // For exact-out, the amountOut is fixed. The minAmountOut is this fixed amount minus slippage.
          // The slippage is applied to the amount the user wants to receive.
          minAmountOut = new Decimal(amountOut).mul(new Decimal(1).minus(new Decimal(slippage).div(100))).toNumber();
        }

        const maxAmountIn = byAmountIn
          ? amountIn
          : new Decimal(swapEventData.amount_calculated.toString()).div(10 ** inputDecimals).toNumber();
        const price = amountIn > 0 ? (byAmountIn ? amountOut / amountIn : amountIn / amountOut) : 0;

        // Calculate price impact
        const startPrice = TickMath.sqrtPriceX64ToPrice(
          new BN(pool.current_sqrt_price),
          poolMeta.coinADecimals,
          poolMeta.coinBDecimals,
        );
        const endPrice = TickMath.sqrtPriceX64ToPrice(
          new BN(swapEventData.end_sqrt_price),
          poolMeta.coinADecimals,
          poolMeta.coinBDecimals,
        );

        let priceImpact: Decimal;
        if (byAmountIn) {
          // For SELL (exact-in), price moves down. (endPrice < startPrice).
          // Formula: 1 - (end / start) is more numerically stable than (start - end) / start
          priceImpact = startPrice.isZero()
            ? new Decimal(0)
            : new Decimal(1).minus(endPrice.div(startPrice)).abs().times(100);
          // priceImpact = startPrice.isZero() ? new Decimal(0) : new Decimal(1).sub(endPrice.div(startPrice)).abs().times(100);
        } else {
          // For BUY (exact-out), price moves up. (endPrice > startPrice).
          // Formula: 1 - (start / end) is more numerically stable than (end - start) / end
          priceImpact = endPrice.isZero()
            ? new Decimal(0)
            : new Decimal(1).minus(startPrice.div(endPrice)).abs().times(100);
          // priceImpact = endPrice.isZero() ? new Decimal(0) : new Decimal(1).sub(startPrice.div(endPrice)).abs().times(100);
        }

        const quoteResponse: QuoteSwapResponseType = {
          poolAddress: pool.id,
          tokenIn: tokenIn,
          tokenOut: tokenOut,
          amountIn: amountIn,
          amountOut: amountOut,
          price: price,
          slippagePct: slippage,
          minAmountOut: minAmountOut,
          maxAmountIn: maxAmountIn,
          priceImpactPct: priceImpact.toNumber(),
        };

        logger.info(`[Bluefin] quote - swap response: ${JSON.stringify(quoteResponse, null, 2)}`);
        return quoteResponse;
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
