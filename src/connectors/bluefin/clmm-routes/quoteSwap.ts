import { TickMath, toBigNumber } from '@firefly-exchange/library-sui';
import { ISwapParams, parsePool } from '@firefly-exchange/library-sui/spot';
import { SuiTransactionBlockResponse } from '@mysten/sui/client';
import { BN } from 'bn.js';
import Decimal from 'decimal.js';
import { FastifyInstance } from 'fastify';

import { QuoteSwapResponseType, QuoteSwapResponse } from '../../../schemas/clmm-schema';
import { logger } from '../../../services/logger';
import { Bluefin } from '../bluefin';
import { getPool } from '../clmm-routes/poolInfo';
import { BluefinRouterQuoteSwapRequest } from '../schemas';

// interface SwapResultEvent {
//   a2b: boolean;
//   amount_calculated: string;
//   amount_specified: string;
//   end_sqrt_price: string;
// }

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
      console.log('quote-swap request:', JSON.stringify(req.query, null, 2));
      try {
        const {
          network = 'mainnet',
          poolAddress,
          baseToken,
          quoteToken,
          amount,
          side,
          slippagePct: slippage = 0.5,
        } = req.query as BluefinRouterQuoteSwapRequest;

        // Validate essential parameters
        if (!baseToken || !quoteToken || !amount || !side) {
          throw fastify.httpErrors.badRequest('baseToken, quoteToken, amount, and side are required');
        }

        const bluefin = Bluefin.getInstance(network);
        const onChain = bluefin.onChain(); // No signer needed for dry run
        const pool = await getPool(poolAddress, network);
        const poolMeta = parsePool(pool);

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
          amountOut: 0,
          aToB: aToB,
          byAmountIn: true,
          slippage: slippage,
        };
        console.log('quote-swap swapParams:', JSON.stringify(swapParams, null, 2));
        const swapResult = (await onChain.computeSwapResults(swapParams)) as SuiTransactionBlockResponse;

        // The actual swap result is in the `parsedJson` of the SwapResult event
        const swapEventData = swapResult.events?.find((e) => e.type.endsWith('::pool::SwapResult'))?.parsedJson as any;

        if (!swapEventData) {
          throw new Error('Could not find SwapResult event in the transaction effects.');
        }

        const amountIn = new Decimal(swapEventData.amount_specified.toString()).div(10 ** inputDecimals).toNumber();
        const amountOut = new Decimal(swapEventData.amount_calculated.toString()).div(10 ** outputDecimals).toNumber();

        // Manually calculate minAmountOut based on slippage, as the SDK does not provide a utility for this in quote calculation.
        const minAmountOutBN = new Decimal(swapEventData.amount_calculated.toString())
          .mul(new Decimal(1).minus(new Decimal(slippage).div(100)))
          .floor();
        const minAmountOut = new Decimal(minAmountOutBN.toString()).div(10 ** outputDecimals).toNumber();

        const price = amountIn > 0 ? amountOut / amountIn : 0;

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

        const priceImpact = startPrice.isZero()
          ? new Decimal(0)
          : new Decimal(endPrice).div(startPrice).minus(1).abs().times(100);

        const quoteResponse: QuoteSwapResponseType = {
          poolAddress: pool.id,
          tokenIn: tokenIn,
          tokenOut: tokenOut,
          amountIn: amountIn,
          amountOut: amountOut,
          price: price,
          slippagePct: slippage,
          minAmountOut: minAmountOut,
          maxAmountIn: amountIn,
          priceImpactPct: priceImpact.toNumber(),
        };

        console.log('quote-swap response:', JSON.stringify(quoteResponse, null, 2));
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
