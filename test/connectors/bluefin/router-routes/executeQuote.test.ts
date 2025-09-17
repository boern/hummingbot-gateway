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

describe('Bluefin Router executeQuote', () => {
  it('should return a transaction hash for executing a quote', async () => {
    // Test implementation will go here
  });
});
