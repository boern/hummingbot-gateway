import { Type } from '@sinclair/typebox';

import { getSuiChainConfig } from '../../chains/sui/sui.config';

import { BluefinConfig } from './bluefin.config';

const suiChainConfig = getSuiChainConfig();

const BASE_TOKEN = 'SUI';
const QUOTE_TOKEN = 'USDC';
const SWAP_AMOUNT = 0.01;
const LOWER_PRICE_BOUND = 100;
const UPPER_PRICE_BOUND = 300;
const BASE_TOKEN_AMOUNT = 0.01;
const QUOTE_TOKEN_AMOUNT = 2;

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

export const BluefinPoolInfoSchema = Type.Object({
  id: Type.String({ description: 'Pool ID' }),
  name: Type.String({ description: 'Pool Name' }),
  fee_rate: Type.Number({ description: 'Fee Rate' }),
  coin_a: Type.Object({
    address: Type.String({ description: 'Coin A Address' }),
    balance: Type.String({ description: 'Coin A Balance' }),
    decimals: Type.Number({ description: 'Coin A Decimals' }),
  }),
  coin_b: Type.Object({
    address: Type.String({ description: 'Coin B Address' }),
    balance: Type.String({ description: 'Coin B Balance' }),
    decimals: Type.Number({ description: 'Coin B Decimals' }),
  }),
  current_sqrt_price: Type.String({ description: 'Current Sqrt Price' }),
  current_tick: Type.Number({ description: 'Current Tick' }),
  liquidity: Type.String({ description: 'Liquidity' }),
  is_paused: Type.Boolean({ description: 'Is Paused' }),
  ticks_manager: Type.Object({
    bitmap: Type.Object({}), // You might want to define a more specific type here if the structure is known
    tick_spacing: Type.Number({ description: 'Tick Spacing' }),
    ticks: Type.Object({}), // Same as bitmap, define a more specific type if possible
  }),
  observations_manager: Type.Object({}), // Define a more specific type here if possible
  rewardsInfo: Type.Array(Type.Object({})), // Define a more specific type here if possible
  protocol_fee_coin_a: Type.Number({ description: 'Protocol Fee Coin A' }),
  protocol_fee_coin_b: Type.Number({ description: 'Protocol Fee Coin B' }),
});

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

export const BluefinCLMMGetPositionInfoRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'Sui network to use',
      default: suiChainConfig.defaultNetwork,
      enum: [...BluefinConfig.networks],
    }),
  ),
  positionAddress: Type.String({
    description: 'The ID of the position to get information for',
    examples: ['0xdfb915d248674db372adfc3caba299bf0ce2ed216a6475498eabbd28c92b6c84'],
  }),
  walletAddress: Type.Optional(
    Type.String({
      description:
        'Sui wallet address (currently not used by Bluefin for this endpoint but included for schema consistency)',
      examples: ['0xa2d6fcd5ed2ae13fe527a96c96100120d519900599f33e38ee112d80e51f9269'],
    }),
  ),
});

export const BluefinCLMMOpenPositionRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'Sui network to use',
      default: suiChainConfig.defaultNetwork,
      enum: [...BluefinConfig.networks],
    }),
  ),
  walletAddress: Type.Optional(
    Type.String({
      description: 'Sui wallet address to open the position with',
      default: suiChainConfig.defaultWallet,
    }),
  ),
  poolAddress: Type.String({
    description: 'Bluefin CLMM pool address',
    examples: [CLMM_POOL_ADDRESS_EXAMPLE],
  }),
  lowerPrice: Type.Number({
    description: 'Lower price bound for the position',
    examples: [LOWER_PRICE_BOUND],
  }),
  upperPrice: Type.Number({
    description: 'Upper price bound for the position',
    examples: [UPPER_PRICE_BOUND],
  }),
  baseTokenAmount: Type.Optional(
    Type.Number({
      description: 'Amount of base token to deposit',
      examples: [BASE_TOKEN_AMOUNT],
    }),
  ),
  quoteTokenAmount: Type.Optional(
    Type.Number({
      description: 'Amount of quote token to deposit',
      examples: [QUOTE_TOKEN_AMOUNT],
    }),
  ),
  slippagePct: Type.Optional(
    Type.Number({
      description: 'Allowed slippage percentage (e.g., 0.5 for 0.5%)',
      default: 0.5,
    }),
  ),
});

export type BluefinCLMMOpenPositionRequest = typeof BluefinCLMMOpenPositionRequest.static;

export const BluefinCLMMQuotePositionRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'Sui network to use',
      default: suiChainConfig.defaultNetwork,
      enum: [...BluefinConfig.networks],
    }),
  ),
  lowerPrice: Type.Number({
    description: 'Lower price bound for the position',
    examples: [LOWER_PRICE_BOUND],
  }),
  upperPrice: Type.Number({
    description: 'Upper price bound for the position',
    examples: [UPPER_PRICE_BOUND],
  }),
  poolAddress: Type.String({
    description: 'Bluefin CLMM pool address',
    examples: [CLMM_POOL_ADDRESS_EXAMPLE],
  }),
  baseTokenAmount: Type.Optional(
    Type.Number({
      description: 'Amount of base token to deposit',
      examples: [BASE_TOKEN_AMOUNT],
    }),
  ),
  quoteTokenAmount: Type.Optional(
    Type.Number({
      description: 'Amount of quote token to deposit',
      examples: [QUOTE_TOKEN_AMOUNT],
    }),
  ),
  slippagePct: Type.Optional(
    Type.Number({
      description:
        'Allowed slippage percentage (e.g., 0.5 for 0.5%) - not used by Bluefin quote, but included for schema consistency',
      default: 0.5,
    }),
  ),
});

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
  positionAddress: Type.String({
    description: 'The ID of the position to add liquidity to',
    examples: ['0xa2d6fcd5ed2ae13fe527a96c96100120d519900599f33e38ee112d80e51f9269'],
  }),
  baseTokenAmount: Type.Number({
    description: 'Amount of base token to add',
    examples: [BASE_TOKEN_AMOUNT],
  }),
  quoteTokenAmount: Type.Number({
    description: 'Amount of quote token to add',
    examples: [QUOTE_TOKEN_AMOUNT],
  }),
  slippagePct: Type.Optional(
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
  positionAddress: Type.String({
    description: 'The ID of the position to remove liquidity from',
    examples: ['0xa2d6fcd5ed2ae13fe527a96c96100120d519900599f33e38ee112d80e51f9269'],
  }),
  percentageToRemove: Type.Number({
    minimum: 0,
    maximum: 100,
    description: 'Percentage of liquidity to remove',
    examples: [100],
  }),
});

export type BluefinCLMMRemoveLiquidityRequest = typeof BluefinCLMMRemoveLiquidityRequest.static;

export const BluefinRouterQuoteSwapRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'Sui network to use',
      default: suiChainConfig.defaultNetwork,
      enum: [...BluefinConfig.networks],
    }),
  ),
  poolAddress: Type.Optional(
    Type.String({
      description: 'CLMM pool address (optional - can be looked up from tokens)',
      examples: [CLMM_POOL_ADDRESS_EXAMPLE],
    }),
  ),
  baseToken: Type.String({
    description: 'Token to determine swap direction',
    examples: [BASE_TOKEN],
  }),
  quoteToken: Type.Optional(
    Type.String({
      description: 'The other token in the pair',
      examples: [QUOTE_TOKEN],
    }),
  ),
  amount: Type.Number({
    description: 'Amount to swap',
    examples: [SWAP_AMOUNT],
  }),
  side: Type.String({
    description: 'Trade direction',
    enum: ['BUY', 'SELL'],
    default: 'SELL',
  }),
  slippagePct: Type.Optional(
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
  baseToken: Type.String({
    description: 'Address of the token to sell',
    examples: [BASE_TOKEN],
  }),
  quoteToken: Type.String({
    description: 'Address of the token to buy',
    examples: [QUOTE_TOKEN],
  }),
  amount: Type.Number({
    description: 'Amount of tokenIn to sell (in full units)',
    examples: [SWAP_AMOUNT],
  }),
  side: Type.String({
    description: 'Trade direction',
    enum: ['BUY', 'SELL'],
    default: 'SELL',
    examples: ['SELL'],
  }),
  slippagePct: Type.Optional(
    Type.Number({
      minimum: 0,
      maximum: 100,
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
    examples: [suiChainConfig.defaultWallet],
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
  slippagePct: Type.Optional(
    Type.Number({
      description: 'Allowed slippage percentage (e.g., 0.5 for 0.5%)',
      default: 0.5,
    }),
  ),
});

export type BluefinRouterExecuteQuoteRequest = typeof BluefinRouterExecuteQuoteRequest.static;

export const BluefinCLMMClosePositionRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'Sui network to use',
      default: suiChainConfig.defaultNetwork,
      enum: [...BluefinConfig.networks],
    }),
  ),
  walletAddress: Type.String({
    description: 'Sui wallet address to collect fees from',
    examples: [suiChainConfig.defaultWallet],
  }),
  positionAddress: Type.String({
    description: 'The ID of the position to collect fees from',
    examples: ['0xa2d6fcd5ed2ae13fe527a96c96100120d519900599f33e38ee112d80e51f9269'],
  }),
});
export type BluefinCLMMClosePositionRequest = typeof BluefinCLMMClosePositionRequest.static;

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
  positionAddress: Type.String({
    description: 'The ID of the position to collect fees from',
    examples: ['0xd13d312ec4a31b2ef873568bf8115ea4bb381583a226bfb20cbd60ce1abb7844'],
  }),
});

export type BluefinCLMMCollectFeesRequest = typeof BluefinCLMMCollectFeesRequest.static;

export const BluefinCLMMAccruedRewardsRequest = Type.Object(
  {
    network: Type.Optional(
      Type.String({
        description: 'Sui network to use',
        default: suiChainConfig.defaultNetwork,
        enum: [...BluefinConfig.networks],
      }),
    ),
    walletAddress: Type.String({ description: 'The address of the wallet.' }),
    positionAddress: Type.String({ description: 'The address of the position.' }),
  },
  {
    description: 'Request to get accrued rewards for a Bluefin CLMM position.',
  },
);

export const AccruedFeeAndRewardInfoSchema = Type.Object({
  symbol: Type.String(),
  amount: Type.Number(),
  address: Type.String(),
});

export const AccruedFeeAndRewardsResponse = Type.Array(AccruedFeeAndRewardInfoSchema);
