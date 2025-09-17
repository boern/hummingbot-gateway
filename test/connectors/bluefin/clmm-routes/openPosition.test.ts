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

describe('Bluefin CLMM openPosition', () => {
  it('should return a transaction hash and position ID for opening a position', async () => {
    // Test implementation will go here
  });
});
