import { mockConfigManagerV2 } from '../../../mocks/shared-mocks';
jest.mock('../../../../src/services/config-manager-v2', () => ({ ConfigManagerV2: mockConfigManagerV2 }));

import Fastify, { FastifyInstance } from 'fastify';

import { Sui } from '../../../../src/chains/sui/sui';
import { suiRoutes } from '../../../../src/chains/sui/sui.routes';

jest.mock('../../../../src/chains/sui/sui');

describe('Sui Estimate Gas Route', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(suiRoutes, { prefix: '/chains/sui' });

    const mockSui = {
      getReferenceGasPrice: jest.fn().mockResolvedValue(BigInt(1000)),
      nativeTokenSymbol: 'SUI',
    };

    (Sui.getInstance as jest.Mock).mockReturnValue(Promise.resolve(mockSui));
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /chains/sui/estimate-gas should return gas estimate', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/chains/sui/estimate-gas?network=mainnet',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.feePerComputeUnit).toBe(1000);
    expect(body.denomination).toBe('MIST');
    expect(body.feeAsset).toBe('SUI');
  });
});
