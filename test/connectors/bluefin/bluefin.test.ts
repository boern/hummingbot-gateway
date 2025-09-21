import { Bluefin } from '../../../src/connectors/bluefin/bluefin';

// Mock ConfigManagerV2 to provide necessary configuration for tests
jest.mock('../../../src/services/config-manager-v2', () => {
  const { mockConfigManagerV2 } = require('../../mocks/shared-mocks');
  // Provide a basic sui config to prevent namespace errors
  mockConfigManagerV2.get.mockImplementation((key: string) => {
    if (key.startsWith('sui')) return {};
  });
  return { ConfigManagerV2: { getInstance: () => mockConfigManagerV2 } };
});

describe('Bluefin Connector', () => {
  it('should get a singleton instance for a given network', () => {
    const instance1 = Bluefin.getInstance('mainnet');
    const instance2 = Bluefin.getInstance('mainnet');
    const instance3 = Bluefin.getInstance('testnet');

    expect(instance1).toBe(instance2);
    expect(instance1).not.toBe(instance3);
  });

  it('should have query and onChain properties', () => {
    const instance = Bluefin.getInstance('mainnet');
    expect(instance.query).toBeDefined();
    expect(instance.onChain).toBeDefined();
  });

  it('should initialize SuiClient correctly', () => {
    const instance = Bluefin.getInstance('mainnet');
    expect(instance.sui).toBeDefined();
  });
});
