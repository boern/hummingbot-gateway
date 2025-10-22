import { parsePool } from '@firefly-exchange/library-sui/spot';
import Decimal from 'decimal.js';
import { FastifyInstance, FastifyRequest } from 'fastify';

import { Sui } from '../../../chains/sui/sui';
import { logger } from '../../../services/logger';
import { TokenService } from '../../../services/token-service';
import { Bluefin } from '../bluefin';
import {
  BluefinCLMMAccruedRewardsRequest as BluefinCLMMAccruedRewardsRequest,
  AccruedFeeAndRewardsResponse as AccruedFeeAndRewardsResponse,
} from '../schemas';

import { getPool } from './poolInfo';

export const getAccruedFeeAndRewardsRoute = async (fastify: FastifyInstance) => {
  fastify.get(
    '/accrued-fee-and-rewards',
    {
      schema: {
        description: 'Get accrued rewards from an existing Bluefin CLMM position',
        tags: ['/connector/bluefin'],
        querystring: BluefinCLMMAccruedRewardsRequest,
        response: {
          200: AccruedFeeAndRewardsResponse,
        },
      },
    },
    async (req: FastifyRequest<{ Querystring: typeof BluefinCLMMAccruedRewardsRequest.static }>, reply) => {
      try {
        const { network = 'mainnet', walletAddress, positionAddress } = req.query;
        logger.info(`[Bluefin] Received /get-accrued-fee-and-rewards request: ${JSON.stringify(req.query)}`);

        const sui = await Sui.getInstance(network);
        const keypair = await sui.getWallet(walletAddress);
        const bluefin = Bluefin.getInstance(network);
        const onChain = bluefin.onChain(keypair);

        // 1. Get position info to find the pool
        const positionInfo = await bluefin.query.getPositionDetails(positionAddress);
        if (!positionInfo) {
          throw fastify.httpErrors.notFound(`Position with ID ${positionAddress} not found.`);
        }
        const pool = await getPool(positionInfo.pool_id, network);
        const poolMeta = parsePool(pool);

        // 2. Get accrued fees and rewards
        const accruedFeesAndRewards = await onChain.getAccruedFeeAndRewards(pool, positionAddress);
        logger.info(`[Bluefin] onChain.getAccruedFeeAndRewards response: ${JSON.stringify(accruedFeesAndRewards)}`);

        const tokenService = TokenService.getInstance();

        // 3. Use a map to collect and merge fees and rewards by full address
        const combined = new Map<string, { symbol: string; amount: Decimal; address: string }>();

        // Process fees
        const feeTokens = [
          { token: pool.coin_a, amount: accruedFeesAndRewards.fee.coinA },
          { token: pool.coin_b, amount: accruedFeesAndRewards.fee.coinB },
        ];

        for (const { token, amount } of feeTokens) {
          const tokenInfo = await tokenService.getToken('sui', network, token.address);
          const symbol = tokenInfo ? tokenInfo.symbol : token.address;
          const currentAmount = combined.get(token.address)?.amount || new Decimal(0);
          combined.set(token.address, {
            symbol: symbol,
            amount: currentAmount.add(new Decimal(amount.toString()).div(10 ** token.decimals)),
            address: token.address,
          });
        }

        // Process rewards
        accruedFeesAndRewards.rewards.forEach((reward) => {
          // Ensure reward address has '0x' prefix
          const fullAddress = reward.coinType.startsWith('0x') ? reward.coinType : `0x${reward.coinType}`;
          const currentAmount = combined.get(fullAddress)?.amount || new Decimal(0);
          combined.set(fullAddress, {
            symbol: reward.coinSymbol,
            amount: currentAmount.add(new Decimal(reward.coinAmount).div(10 ** reward.coinDecimals)),
            address: fullAddress,
          });
        });

        // 4. Convert map to final array response
        const result = Array.from(combined.values()).map((item) => ({ ...item, amount: item.amount.toNumber() }));

        logger.info(`[Bluefin] Sending accrued rewards and fees: ${JSON.stringify(result)}`);
        reply.send(result);
      } catch (e) {
        logger.error(`[Bluefin] Error in /accrued-fee-and-rewards: ${e.message}`, e);
        throw fastify.httpErrors.internalServerError(e.message);
      }
    },
  );
};
