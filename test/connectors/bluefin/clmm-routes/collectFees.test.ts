import { FastifyInstance } from 'fastify';

import { gatewayApp } from '../../../../src/app';

let app: FastifyInstance;
beforeAll(async () => {
  app = await gatewayApp;
  await app.ready();
});

afterAll(() => {
  app.close();
});

describe('Bluefin CLMM collectFees', () => {
  it('should return a transaction hash for collecting fees', async () => {
    // Test implementation will go here
  });
});
