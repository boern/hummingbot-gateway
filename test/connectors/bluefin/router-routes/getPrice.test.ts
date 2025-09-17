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

describe('Bluefin Router getPrice', () => {
  it('should return a price for a given token pair', async () => {
    // Test implementation will go here
  });
});
