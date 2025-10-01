import { FastifyPluginAsync } from 'fastify';

import { addHardwareWalletRoute } from './routes/addHardwareWallet';
import { addWalletRoute } from './routes/addWallet';
import { getWalletsRoute } from './routes/getWallets';
import { removeWalletRoute } from './routes/removeWallet';
import { setDefaultRoute } from './routes/setDefault';
import { transferRoute } from './routes/transfer';

export const walletRoutes: FastifyPluginAsync = async (fastify) => {
  // Register individual route handlers
  await fastify.register(getWalletsRoute);
  await fastify.register(addWalletRoute);
  await fastify.register(addHardwareWalletRoute);
  await fastify.register(removeWalletRoute);
  await fastify.register(setDefaultRoute);
  await fastify.register(transferRoute);
};

export default walletRoutes;
