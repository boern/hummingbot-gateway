import { FastifyInstance } from 'fastify';

// import { App } from '../../../src/app';
import { gatewayApp } from '../../../src/app';
let app: FastifyInstance;

beforeAll(async () => {
  app = await gatewayApp;
  await app.ready();
});

afterAll(() => {
  app.close();
});

describe('Bluefin Routes Registration', () => {
  it('should register CLMM routes under /clmm prefix', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/connectors/bluefin/clmm/pool-info?poolAddress=0x123',
    });
    // We expect a 500 error because the mock will fail, but not a 404
    expect(response.statusCode).not.toBe(404);
  });

  it('should register Router routes under /router prefix', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/connectors/bluefin/router/get-price?poolAddress=0x123&tokenIn=0xabc',
    });
    // We expect a 500 error because the mock will fail, but not a 404
    expect(response.statusCode).not.toBe(404);
  });
});
