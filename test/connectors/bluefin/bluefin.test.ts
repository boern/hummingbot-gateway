import { Bluefin } from '../../../src/connectors/bluefin/bluefin';

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
