import Fastify, { FastifyInstance } from 'fastify';

import { Sui } from '../../../../src/chains/sui/sui';
import { suiRoutes } from '../../../../src/chains/sui/sui.routes';
import { StatusResponseType } from '../../../../src/schemas/chain-schema';

jest.mock('../../../../src/chains/sui/sui');

describe('Sui Status Route', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(suiRoutes, { prefix: '/chains/sui' });

    const mockSui = {
      getCurrentBlockNumber: jest.fn().mockResolvedValue(12345),
      rpcUrl: 'https://fullnode.mainnet.sui.io:443',
      nativeTokenSymbol: 'SUI',
    };

    (Sui.getInstance as jest.Mock).mockReturnValue(Promise.resolve(mockSui));
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /chains/sui/status should return node info', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/chains/sui/status?network=mainnet',
    });

    expect(response.statusCode).toBe(200);
    const body: StatusResponseType = JSON.parse(response.body);
    expect(body.chain).toBe('sui');
    expect(body.network).toBe('mainnet');
    expect(body.currentBlockNumber).toBe(12345);
    expect(body.rpcUrl).toBe('https://fullnode.mainnet.sui.io:443');
    expect(body.nativeCurrency).toBe('SUI');
  });
});
