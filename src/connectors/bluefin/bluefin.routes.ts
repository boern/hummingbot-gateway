import sensible from '@fastify/sensible';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { bluefinCLMMRoutes } from './clmm-routes';

const bluefinClmmRoutesWrapper: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  await fastify.register(sensible);

  await fastify.register(async (instance) => {
    // This hook ensures that all routes registered in this plugin
    // are correctly tagged for Swagger documentation.
    instance.addHook('onRoute', (routeOptions) => {
      if (routeOptions.schema && routeOptions.schema.tags) {
        // Replace the generic tag with the specific connector tag.
        routeOptions.schema.tags = ['/connector/bluefin'];
      }
    });

    // Register all the CLMM routes.
    await instance.register(bluefinCLMMRoutes);
  });
};

// Main export that combines all Bluefin routes.
// This structure is extensible for other types like AMM or Router in the future.
export const bluefinRoutes = {
  clmm: bluefinClmmRoutesWrapper,
};

// We also need to adjust how routes are registered in `app.ts` to use this new structure.
// The registration in `src/app.ts` should be changed from:
// app.register(bluefinRoutes, { prefix: '/connectors/bluefin' });
// to:
// app.register(bluefinRoutes.clmm, { prefix: '/connectors/bluefin/clmm' });
