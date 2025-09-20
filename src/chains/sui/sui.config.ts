import { ConfigManagerV2 } from '../../services/config-manager-v2';

import { getAvailableSuiNetworks } from './sui.utils';

export interface SuiNetworkConfig {
  rpcURL: string;
  nativeCurrency: string;
}

export interface SuiChainConfig {
  defaultNetwork: string;
  defaultWallet: string;
}

// Export available networks
export const networks = getAvailableSuiNetworks();

export function getSuiNetworkConfig(network: string): SuiNetworkConfig {
  const namespaceId = `sui-${network}`;
  return {
    rpcURL: ConfigManagerV2.getInstance().get(namespaceId + '.rpcURL'),
    nativeCurrency: ConfigManagerV2.getInstance().get(namespaceId + '.nativeCurrency'),
  };
}

export function getSuiChainConfig(): SuiChainConfig {
  return {
    defaultNetwork: ConfigManagerV2.getInstance().get('sui.defaultNetwork'),
    defaultWallet: ConfigManagerV2.getInstance().get('sui.defaultWallet'),
  };
}
