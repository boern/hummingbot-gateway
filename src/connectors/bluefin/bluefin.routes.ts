import { FastifyInstance } from 'fastify';

import { bluefinCLMMRoutes } from './clmm-routes';
import { bluefinRouterRoutes } from './router-routes';

export async function bluefinRoutes(fastify: FastifyInstance) {
  await fastify.register(bluefinCLMMRoutes, { prefix: '/clmm' });
  await fastify.register(bluefinRouterRoutes, { prefix: '/router' });
}
export default bluefinRoutes;
