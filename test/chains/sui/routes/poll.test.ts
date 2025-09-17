import { mockConfigManagerV2 } from '../../../mocks/shared-mocks';
jest.mock('../../../../src/services/config-manager-v2', () => ({ ConfigManagerV2: mockConfigManagerV2 }));

import Fastify, { FastifyInstance } from 'fastify';

import { Sui } from '../../../../src/chains/sui/sui';
import { suiRoutes } from '../../../../src/chains/sui/sui.routes';

jest.mock('../../../../src/chains/sui/sui');

describe('Sui Poll Route', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(suiRoutes, { prefix: '/chains/sui' });

    const mockTxData = { digest: 'tx123', checkpoint: '54321' };
    const mockSui = {
      getTransactionBlock: jest.fn().mockResolvedValue(mockTxData),
      getTransactionStatusCode: jest.fn().mockReturnValue(1),
      getFee: jest.fn().mockReturnValue(0.001),
      getCurrentBlockNumber: jest.fn().mockResolvedValue(99999),
    };

    (Sui.getInstance as jest.Mock).mockReturnValue(Promise.resolve(mockSui));
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /chains/sui/poll should return transaction details', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/chains/sui/poll',
      payload: {
        network: 'mainnet',
        signature: 'tx123',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.signature).toBe('tx123');
    expect(body.txBlock).toBe(54321);
    expect(body.txStatus).toBe(1);
    expect(body.fee).toBe(0.001);
    expect(body.txData).toEqual({ digest: 'tx123', checkpoint: '54321' });
  });
});
