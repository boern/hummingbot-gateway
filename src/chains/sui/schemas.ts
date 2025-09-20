import { Type } from '@sinclair/typebox';

import { getSuiChainConfig, networks as SuiNetworks } from './sui.config';

// Get chain config for defaults
const suiChainConfig = getSuiChainConfig();

// Example values
const EXAMPLE_DIGEST = 'G2XoVYKXD4Vy2skGrmHNcXKX9J3rPVSY5SvRRF9XeQxG';
const EXAMPLE_TOKENS = ['SUI', 'WAL', 'USDC'];

// Network parameter with proper defaults and enum
export const SuiNetworkParameter = Type.Optional(
  Type.String({
    description: 'The Sui network to use',
    default: suiChainConfig.defaultNetwork,
    enum: SuiNetworks,
  }),
);

// Address parameter with proper defaults
export const SuiAddressParameter = Type.Optional(
  Type.String({
    description: 'Sui wallet address',
    default: suiChainConfig.defaultWallet,
  }),
);

// Status request schema
export const SuiStatusRequest = Type.Object({
  network: SuiNetworkParameter,
});

// Balance request schema
export const SuiBalanceRequest = Type.Object({
  network: SuiNetworkParameter,
  address: SuiAddressParameter,
  tokens: Type.Optional(
    Type.Array(Type.String(), {
      description:
        'A list of token symbols (SUI, WAL, USDC). Both formats are accepted and will be automatically detected. An empty array is treated the same as if the parameter was not provided, returning only non-zero balances (with the exception of SUI).',
      examples: [EXAMPLE_TOKENS],
    }),
  ),
  fetchAll: Type.Optional(
    Type.Boolean({
      description: 'Whether to fetch all tokens in wallet, not just those in token list',
      default: false,
    }),
  ),
});

// Estimate gas request schema
export const SuiEstimateGasRequest = Type.Object({
  network: SuiNetworkParameter,
});

// Poll request schema
export const SuiPollRequest = Type.Object({
  network: SuiNetworkParameter,
  signature: Type.String({
    description: 'Transaction digest to poll',
    examples: [EXAMPLE_DIGEST],
  }),
  tokens: Type.Optional(
    Type.Array(Type.String(), {
      description: 'Tokens to track balance changes for',
      examples: [EXAMPLE_TOKENS],
    }),
  ),
  walletAddress: Type.Optional(
    Type.String({
      description: 'Wallet address to track balance changes for',
      default: suiChainConfig.defaultWallet,
    }),
  ),
});
