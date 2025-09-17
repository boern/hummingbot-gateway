import { mockConfigManagerV2 } from '../../../mocks/shared-mocks';
jest.mock('../../../../src/services/config-manager-v2', () => ({ ConfigManagerV2: mockConfigManagerV2 }));

import Fastify, { FastifyInstance } from 'fastify';

import { Sui } from '../../../../src/chains/sui/sui';
import { suiRoutes } from '../../../../src/chains/sui/sui.routes';

jest.mock('../../../../src/chains/sui/sui');

describe('Sui Balances Route', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(suiRoutes, { prefix: '/chains/sui' });

    const mockSui = {
      getBalances: jest.fn().mockResolvedValue({ SUI: 1.23, USDC: 100 }),
    };

    (Sui.getInstance as jest.Mock).mockReturnValue(Promise.resolve(mockSui));
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /chains/sui/balances should return balances', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/chains/sui/balances',
      payload: {
        network: 'mainnet',
        address: '0x123',
        tokens: ['SUI', 'USDC'],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.balances).toEqual({ SUI: 1.23, USDC: 100 });
  });
});
