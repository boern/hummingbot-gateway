import { ConfigManagerV2 } from '../../services/config-manager-v2';

import { getAvailableSuiNetworks } from './sui.utils';

export interface SuiNetworkConfig {
  nodeURL: string;
  nativeCurrencySymbol: string;
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
    nodeURL: ConfigManagerV2.getInstance().get(namespaceId + '.nodeURL'),
    nativeCurrencySymbol: ConfigManagerV2.getInstance().get(namespaceId + '.nativeCurrencySymbol'),
  };
}

export function getSuiChainConfig(): SuiChainConfig {
  return {
    defaultNetwork: ConfigManagerV2.getInstance().get('sui.defaultNetwork'),
    defaultWallet: ConfigManagerV2.getInstance().get('sui.defaultWallet'),
  };
}
