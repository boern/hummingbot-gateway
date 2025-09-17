import { Type } from '@sinclair/typebox';

import { getSuiChainConfig } from '../../chains/sui/sui.config';

import { BluefinConfig } from './bluefin.config';

const suiChainConfig = getSuiChainConfig();

const CLMM_POOL_ADDRESS_EXAMPLE = '0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa';

export const BluefinCLMMGetPoolInfoRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'Sui network to use',
      default: suiChainConfig.defaultNetwork,
      enum: [...BluefinConfig.networks],
    }),
  ),
  poolAddress: Type.String({
    description: 'Bluefin CLMM pool address',
    examples: [CLMM_POOL_ADDRESS_EXAMPLE],
  }),
});

export type BluefinCLMMGetPoolInfoRequest = typeof BluefinCLMMGetPoolInfoRequest.static;

export const BluefinCLMMGetPositionsOwnedRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'Sui network to use',
      default: suiChainConfig.defaultNetwork,
      enum: [...BluefinConfig.networks],
    }),
  ),
  walletAddress: Type.String({
    description: 'Sui wallet address to check for positions',
    examples: ['0xa2d6fcd5ed2ae13fe527a96c96100120d519900599f33e38ee112d80e51f9269'],
  }),
  poolAddress: Type.String({
    description: 'Bluefin CLMM pool address to filter positions',
    examples: [CLMM_POOL_ADDRESS_EXAMPLE],
  }),
});

export type BluefinCLMMGetPositionsOwnedRequest = typeof BluefinCLMMGetPositionsOwnedRequest.static;

export const BluefinCLMMOpenPositionRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'Sui network to use',
      default: suiChainConfig.defaultNetwork,
      enum: [...BluefinConfig.networks],
    }),
  ),
  walletAddress: Type.String({
    description: 'Sui wallet address to open the position with',
    examples: ['0xa2d6fcd5ed2ae13fe527a96c96100120d519900599f33e38ee112d80e51f9269'],
  }),
  poolAddress: Type.String({
    description: 'Bluefin CLMM pool address',
    examples: [CLMM_POOL_ADDRESS_EXAMPLE],
  }),
  lowerPrice: Type.Number({
    description: 'Lower price bound for the position',
  }),
  upperPrice: Type.Number({
    description: 'Upper price bound for the position',
  }),
  amount0: Type.Optional(
    Type.Number({
      description: 'Amount of token0 to deposit',
    }),
  ),
  amount1: Type.Optional(
    Type.Number({
      description: 'Amount of token1 to deposit',
    }),
  ),
  slippage: Type.Optional(
    Type.Number({
      description: 'Allowed slippage percentage (e.g., 0.5 for 0.5%)',
      default: 0.5,
    }),
  ),
});

export type BluefinCLMMOpenPositionRequest = typeof BluefinCLMMOpenPositionRequest.static;

export const BluefinCLMMAddLiquidityRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'Sui network to use',
      default: suiChainConfig.defaultNetwork,
      enum: [...BluefinConfig.networks],
    }),
  ),
  walletAddress: Type.String({
    description: 'Sui wallet address to add liquidity from',
    examples: ['0xa2d6fcd5ed2ae13fe527a96c96100120d519900599f33e38ee112d80e51f9269'],
  }),
  positionId: Type.String({
    description: 'The ID of the position to add liquidity to',
  }),
  amount0: Type.Optional(
    Type.Number({
      description: 'Amount of token0 to deposit',
    }),
  ),
  amount1: Type.Optional(
    Type.Number({
      description: 'Amount of token1 to deposit',
    }),
  ),
  slippage: Type.Optional(
    Type.Number({
      description: 'Allowed slippage percentage (e.g., 0.5 for 0.5%)',
      default: 0.5,
    }),
  ),
  // The Bluefin SDK's provideLiquidityWithFixedAmount requires a `fix_amount_a` flag.
  // We will deduce this from which amount is provided. If both are provided, we can default to true.
  // For simplicity, we won't expose this to the user.
});

export type BluefinCLMMAddLiquidityRequest = typeof BluefinCLMMAddLiquidityRequest.static;

export const BluefinCLMMRemoveLiquidityRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'Sui network to use',
      default: suiChainConfig.defaultNetwork,
      enum: [...BluefinConfig.networks],
    }),
  ),
  walletAddress: Type.String({
    description: 'Sui wallet address to remove liquidity from',
    examples: ['0xa2d6fcd5ed2ae13fe527a96c96100120d519900599f33e38ee112d80e51f9269'],
  }),
  positionId: Type.String({
    description: 'The ID of the position to remove liquidity from',
  }),
  percentage: Type.Optional(
    Type.Number({
      description: 'Percentage of liquidity to remove (e.g., 50 for 50%)',
      default: 100,
      minimum: 0,
      maximum: 100,
    }),
  ),
  slippage: Type.Optional(
    Type.Number({
      description: 'Allowed slippage percentage (e.g., 0.5 for 0.5%)',
      default: 0.5,
    }),
  ),
});

export type BluefinCLMMRemoveLiquidityRequest = typeof BluefinCLMMRemoveLiquidityRequest.static;

export const BluefinCLMMCollectFeesRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'Sui network to use',
      default: suiChainConfig.defaultNetwork,
      enum: [...BluefinConfig.networks],
    }),
  ),
  walletAddress: Type.String({
    description: 'Sui wallet address to collect fees from',
    examples: ['0xa2d6fcd5ed2ae13fe527a96c96100120d519900599f33e38ee112d80e51f9269'],
  }),
  positionId: Type.String({
    description: 'The ID of the position to collect fees from',
  }),
  slippage: Type.Optional(
    Type.Number({
      description: 'Allowed slippage percentage (e.g., 0.5 for 0.5%)',
      default: 0.5,
    }),
  ),
});

export type BluefinCLMMCollectFeesRequest = typeof BluefinCLMMCollectFeesRequest.static;

export const BluefinRouterQuoteSwapRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'Sui network to use',
      default: suiChainConfig.defaultNetwork,
      enum: [...BluefinConfig.networks],
    }),
  ),
  poolAddress: Type.String({
    description: 'Bluefin CLMM pool address',
    examples: [CLMM_POOL_ADDRESS_EXAMPLE],
  }),
  tokenIn: Type.String({
    description: 'Address of the token to sell',
  }),
  tokenOut: Type.String({
    description: 'Address of the token to buy',
  }),
  amount: Type.String({
    description: 'Amount of tokenIn to sell (in full units)',
  }),
  slippage: Type.Optional(
    Type.Number({
      description: 'Allowed slippage percentage (e.g., 0.5 for 0.5%)',
      default: 0.5,
    }),
  ),
});

export type BluefinRouterQuoteSwapRequest = typeof BluefinRouterQuoteSwapRequest.static;

export const BluefinRouterExecuteSwapRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'Sui network to use',
      default: suiChainConfig.defaultNetwork,
      enum: [...BluefinConfig.networks],
    }),
  ),
  walletAddress: Type.String({
    description: 'Sui wallet address to execute the swap with',
    examples: ['0xa2d6fcd5ed2ae13fe527a96c96100120d519900599f33e38ee112d80e51f9269'],
  }),
  poolAddress: Type.String({
    description: 'Bluefin CLMM pool address',
    examples: [CLMM_POOL_ADDRESS_EXAMPLE],
  }),
  tokenIn: Type.String({
    description: 'Address of the token to sell',
  }),
  tokenOut: Type.String({
    description: 'Address of the token to buy',
  }),
  amount: Type.String({
    description: 'Amount of tokenIn to sell (in full units)',
  }),
  slippage: Type.Optional(
    Type.Number({
      description: 'Allowed slippage percentage (e.g., 0.5 for 0.5%)',
      default: 0.5,
    }),
  ),
});

export type BluefinRouterExecuteSwapRequest = typeof BluefinRouterExecuteSwapRequest.static;

export const BluefinRouterGetPriceRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'Sui network to use',
      default: suiChainConfig.defaultNetwork,
      enum: [...BluefinConfig.networks],
    }),
  ),
  poolAddress: Type.String({
    description: 'Bluefin CLMM pool address',
    examples: [CLMM_POOL_ADDRESS_EXAMPLE],
  }),
  tokenIn: Type.String({
    description: 'Address of the token to sell',
  }),
});

export type BluefinRouterGetPriceRequest = typeof BluefinRouterGetPriceRequest.static;

export const BluefinRouterExecuteQuoteRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'Sui network to use',
      default: suiChainConfig.defaultNetwork,
      enum: [...BluefinConfig.networks],
    }),
  ),
  walletAddress: Type.String({
    description: 'Sui wallet address to execute the swap with',
    examples: ['0xa2d6fcd5ed2ae13fe527a96c96100120d519900599f33e38ee112d80e51f9269'],
  }),
  poolAddress: Type.String({
    description: 'Bluefin CLMM pool address',
    examples: [CLMM_POOL_ADDRESS_EXAMPLE],
  }),
  tokenIn: Type.String({
    description: 'Address of the token to sell',
  }),
  tokenOut: Type.String({
    description: 'Address of the token to buy',
  }),
  amount: Type.String({
    description: 'Amount of tokenIn to sell (in full units)',
  }),
  slippage: Type.Optional(
    Type.Number({
      description: 'Allowed slippage percentage (e.g., 0.5 for 0.5%)',
      default: 0.5,
    }),
  ),
});

export type BluefinRouterExecuteQuoteRequest = typeof BluefinRouterExecuteQuoteRequest.static;
