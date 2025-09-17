# Brief
Bluefin 是sui生态上的去中心化交易所（DEX），支持现货和期货交易。[bluefin spot](https://learn.bluefin.io/bluefin/bluefin-spot-clmm/introduction) 支持CLMM，我们要在hummingbot gateway上集成 bluefin spot clmm.

# Task1: 
阅读并理解README中关于[添加Connector (Adding a New Connector)](./README.md#adding-a-new-connector)的章节

# Task2 
## 安装bluefin相关的依赖库
```bash
pnpm i @firefly-exchange/library-sui
```

# Task3 
按照gateway文档说明，为bluefin clmm connector搭建脚手架，创建必要的文件夹和文件

## 为bluefin clmm connector创建routes相关文件
CLMM routes in `clmm-routes/` (for concentrated liquidity)
### bluefin clmm connector的工程结构可以参考raydium clmm connector, bluefin和raydium都支持clmm，只是分属于sui和solana两个不同的生态，两者具有很多相似的地方，因此可以相互参考借鉴。

```bash
$ tree src/connectors/raydium/
src/connectors/raydium/
├── amm-routes
│   ├── addLiquidity.ts
│   ├── executeSwap.ts
│   ├── index.ts
│   ├── poolInfo.ts
│   ├── positionInfo.ts
│   ├── quoteLiquidity.ts
│   ├── quoteSwap.ts
│   └── removeLiquidity.ts
├── clmm-routes
│   ├── addLiquidity.ts
│   ├── closePosition.ts
│   ├── collectFees.ts
│   ├── executeSwap.ts
│   ├── index.ts
│   ├── openPosition.ts
│   ├── poolInfo.ts
│   ├── positionInfo.ts
│   ├── positionsOwned.ts
│   ├── quotePosition.ts
│   ├── quoteSwap.ts
│   └── removeLiquidity.ts
├── raydium.config.ts
├── raydium.routes.ts
├── raydium.ts
├── raydium.utils.ts
└── schemas.ts
```

# Task4
## 为 bluefin clmm connector route 以下接口：
- `GET /connectors/bluefin/clmm/pool-info` - Pool information
- `GET /connectors/bluefin/clmm/positions-owned` - List positions
- `POST /connectors/bluefin/clmm/open-position` - Open position
- `POST /connectors/bluefin/clmm/add-liquidity` - Add to position
- `POST /connectors/bluefin/clmm/remove-liquidity` - Remove from position
- `POST /connectors/bluefin/clmm/collect-fees` - Collect fees
- `GET /connectors/bluefin/router/quote-swap` - Get swap quote
- `POST /connectors/bluefin/router/execute-swap` - Execute swap without quote
- `POST /connectors/bluefin/router/execute-quote` - Execute pre-fetched quote
- `GET /connectors/bluefin/router/get-price` - Get price estimate   
 
### 接口的输入，输出类型需要满足gateway的设计要求，即：providing a unified interface for performing actions like checking balances, executing trades, and managing wallets across different protocols

### 实现上述方法用到的[bluefin exchange api]((https://www.npmjs.com/package/@firefly-exchange/library-sui?activeTab=code))，可以参考如下示例
```typescript

import { QueryChain, OnChainCalls, ISwapParams, ILiquidityParams, IPosition } from "@firefly-exchange/library-sui/spot";
import { SuiClient, Ed25519Keypair, toBigNumber, toBigNumberStr } from "@firefly-exchange/library-sui";
import { TickMath, ClmmPoolUtil } from "@firefly-exchange/library-sui";
import { mainnet } from '../config'
import { BN } from "bn.js";
import { Decimal } from 'decimal.js'

const originalStdoutWrite = process.stdout.write;
process.stdout.write = () => true;
process.stdout.write = originalStdoutWrite;

/**
 * A human-readable representation of a CLMM position.
 */
export interface IHumanReadablePosition extends IPosition {
    lowerPrice: string;
    upperPrice: string;
    coinAmounts: {
        coinA: string;
        coinB: string;
    };
    fees: {
        coinA: string;
        coinB: string;
    };
}

async function toHumanReadablePosition(client: SuiClient, position: IPosition): Promise<IHumanReadablePosition> {
    const pool = await getPool(client, position.pool_id);

    const lowerPrice = TickMath.tickIndexToPrice(position.lower_tick, pool.coin_a.decimals, pool.coin_b.decimals).toFixed(pool.coin_b.decimals);
    const upperPrice = TickMath.tickIndexToPrice(position.upper_tick, pool.coin_a.decimals, pool.coin_b.decimals).toFixed(pool.coin_b.decimals);

    const lowerSqrtPrice = TickMath.tickIndexToSqrtPriceX64(position.lower_tick);
    const upperSqrtPrice = TickMath.tickIndexToSqrtPriceX64(position.upper_tick);

    const coinAmounts = ClmmPoolUtil.getCoinAmountFromLiquidity(new BN(position.liquidity), new BN(pool.current_sqrt_price), lowerSqrtPrice, upperSqrtPrice, false);

    return {
        ...position,
        lowerPrice,
        upperPrice,
        coinAmounts: {
            coinA: new Decimal(coinAmounts.coinA.toString()).div(10 ** pool.coin_a.decimals).toString(),
            coinB: new Decimal(coinAmounts.coinB.toString()).div(10 ** pool.coin_b.decimals).toString(),
        },
        fees: {
            coinA: new Decimal(position.token_a_fee).div(10 ** pool.coin_a.decimals).toString(),
            coinB: new Decimal(position.token_b_fee).div(10 ** pool.coin_b.decimals).toString(),
        }
    };
}

///  retrieve the information on a given pool by its ID (which the user will already have set up in the config.ts file 
/// by retrieving the information through the /pools/info endpoint).
/// Parameters:
/// - poolID          : The id of the the pool ex: 0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa 
export async function getPool(client: SuiClient, poolID: string) {
    let qc = new QueryChain(client);
    let pool = await qc.getPool(poolID);
    // console.log(pool);
    return pool
}

///  retrieve pool current price on a given pool by its ID (which the user will already have set up in the config.ts file 
/// by retrieving the information through the /pools/info endpoint).
/// Parameters:
/// - poolID          : The id of the the pool ex: 0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa 
export async function getPoolCurrentPrice(client: SuiClient, poolID: string) {
    let qc = new QueryChain(client);
    let pool = await qc.getPool(poolID);
    // Q64.64 格式
    const sqrtPriceX64 = new Decimal(pool.current_sqrt_price.toString());
    const Q64 = new Decimal(2).pow(64);
    const sqrtPrice = sqrtPriceX64.div(Q64);
    // price = (sqrtPrice)^2
    let price = sqrtPrice.pow(2);

    // 还要考虑 tokenA/tokenB 的 decimals
    price = price
        .mul(new Decimal(10).pow(pool.coin_a.decimals))
        .div(new Decimal(10).pow(pool.coin_b.decimals));

    // 保留小数位数与结算货币一致
    const decimals = pool.coin_a.decimals;
    const priceStr = price.toFixed(decimals, Decimal.ROUND_DOWN);
    return priceStr;
}


/// retrieve a list of open positions that a user has.
/// Parameters:
/// - userAddress           : The Sui address of the target user for retrieving position data ex: 0xa2d6fcd5ed2ae13fe527a96c96100120d519900599f33e38ee112d80e51f9269
export async function getUserPositions(client: SuiClient, userAddress: string): Promise<IHumanReadablePosition[]> {
    let qc = new QueryChain(client);
    const positions = await qc.getUserPositions(mainnet.BasePackage, userAddress);

    const readablePositions = await Promise.all(
        positions.map(pos => toHumanReadablePosition(client, pos))
    );
    return readablePositions;
}

/// retrieve details of a specific position by providing its ID (which you can retrieve from the getUserPositions() function).
/// Parameters:
/// - posID           : The unique ID of the position being queried
export async function getPositionDetails(client: SuiClient, posID: string) {
    let qc = new QueryChain(client);
    // First, check if the object exists to avoid the library throwing an unhandled error.
    const objectResponse = await client.getObject({ id: posID, options: { showContent: true } });
    if (!objectResponse.data) {
        throw new Error(`Position with ID '${posID}' not found.`);
    }
    // Now call the library function, which we know will succeed.
    let pos = await qc.getPositionDetails(posID);
    // return pos;
    return toHumanReadablePosition(client, pos);
}

/// Calculate the token amounts for a given position at the current point in time
export async function getCoinAmountsFromPositionID(client: SuiClient, posID: string) {
    let qc = new QueryChain(client);
    let pos = await qc.getPositionDetails(posID)
    let pool = await qc.getPool(pos.pool_id);

    let lowerSqrtPrice = TickMath.tickIndexToSqrtPriceX64(pos.lower_tick)
    let upperSqrtPrice = TickMath.tickIndexToSqrtPriceX64(pos.upper_tick)

    const coinAmounts = ClmmPoolUtil.getCoinAmountFromLiquidity(new BN(pos.liquidity), new BN(pool.current_sqrt_price), lowerSqrtPrice, upperSqrtPrice, false)

    return {
        coinAAmount: coinAmounts.coinA.toString(),
        coinBAmount: coinAmounts.coinB.toString()
    };
}

/// open a new position without providing any liquidity. This option is available as from a contract-implementation perspective 
// it's a good practice to have it separated from the functions for providing liquidity, 
// but from a user-perspective the best option will be to use openPositionWithFixedAmount() (explained in the following section) 
// to directly provide liquidity when opening the position and start accruing fees and rewards.
// Only the range of the price (lower and upper) you're providing liquidity for has to be set.
/// Parameters:
/// - privateKey        : The private key of the user making the blockchain call
/// - poolID          	: The id of the the pool ex: 0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa 
/// - lowerPrice				: The lower price boundary. 
///												This should be a decimal such as 1.6 as the decimal places are handled internally
/// - upperPrice				: The upper price boundary. 
///                       This should be a decimal such as 1.7 as the decimal places are handled internally
/// await openPosition("<private key>","0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa",1.765,2.123)
export async function openPosition(client: SuiClient, keyPair: Ed25519Keypair, poolID: string, lowerPrice: number, upperPrice: number) {
    // const keyPair = Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));

    let oc = new OnChainCalls(client, mainnet, { signer: keyPair });
    let qc = new QueryChain(client);
    let pool = await qc.getPool(poolID);

    let lowerTickBits = TickMath.priceToInitializableTickIndex(new Decimal(lowerPrice), pool.coin_a.decimals, pool.coin_b.decimals, pool.ticks_manager.tick_spacing);
    let upperTickBits = TickMath.priceToInitializableTickIndex(new Decimal(upperPrice), pool.coin_a.decimals, pool.coin_b.decimals, pool.ticks_manager.tick_spacing);

    let resp = await oc.openPosition(pool, lowerTickBits, upperTickBits);
    return resp
}

// open a new position and provide liquidity to it straight away.
// Apart from the range you're providing liquidity to, the amount to be provided and the acceptable slippage have to be provided.
// The amount provided refers to the amount of coinA. The amount of coinB is determined based on the current price and range.
/// Parameters:
/// - privateKey        : The private key of the user making the blockchain call
/// - poolID          	: The id of the the pool ex: 0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa 
/// - coinAmount		: The amount of CoinA willing to provide 
///                       This should be a decimal such as 1.7 as the decimal places are handled internally
/// - slippage			: The difference between the expected price of a trade and the actual price at which it is executed.
///						  This should be a number between 0 and 1, eg: 0.2
/// - lowerPrice		: The lower price boundary. 
///						  This should be a decimal such as 1.6 as the decimal places are handled internally
/// - upperPrice		: The upper price boundary. 
///                       This should be a decimal such as 1.7 as the decimal places are handled internally
/// await openPositionWithFixedAmount("<private key>","0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa", 1, 0.5, 1.765, 2.123)

export async function openPositionWithFixedAmount(client: SuiClient, keyPair: Ed25519Keypair, poolID: string, coinAmount: number, slippage: number, lowerPrice: number, upperPrice: number) {
    // const keyPair = Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
    let qc = new QueryChain(client);
    let pool = await qc.getPool(poolID);

    let coinAmountBN = new BN(toBigNumberStr(coinAmount, pool.coin_a.decimals));
    let lowerTick = TickMath.priceToInitializableTickIndex(new Decimal(lowerPrice), pool.coin_a.decimals, pool.coin_b.decimals, pool.ticks_manager.tick_spacing);
    let upperTick = TickMath.priceToInitializableTickIndex(new Decimal(upperPrice), pool.coin_a.decimals, pool.coin_b.decimals, pool.ticks_manager.tick_spacing);

    const curSqrtPrice = new BN(pool.current_sqrt_price);
    const fix_amount_a = true;
    let roundUp = true;

    const liquidityInput = ClmmPoolUtil.estLiquidityAndCoinAmountFromOneAmounts(
        lowerTick,
        upperTick,
        coinAmountBN,
        fix_amount_a,
        roundUp,
        slippage,
        curSqrtPrice
    );
    console.log(liquidityInput);
    let oc = new OnChainCalls(client, mainnet, { signer: keyPair });
    let resp = await oc.openPositionWithFixedAmount(pool, lowerTick, upperTick, liquidityInput);
    return resp
}

/**
 * Opens a new position and provides liquidity using pre-rebalanced amounts of both coinA and coinB.
 * This function calculates the maximum liquidity that can be provided based on the two token amounts
 * and the specified price range.
 *
 * @param client - The SuiClient instance.
 * @param keyPair - The user's keypair for signing transactions.
 * @param poolID - The ID of the liquidity pool.
 * @param coinAAmount - The amount of coinA to provide.
 * @param coinBAmount - The amount of coinB to provide.
 * @param slippage - The acceptable slippage percentage (e.g., 0.5 for 0.5%).
 * @param lowerPrice - The lower price boundary for the position.
 * @param upperPrice - The upper price boundary for the position.
 * @returns The on-chain call response.
 */
export async function openPositionWithBalancedAmount(client: SuiClient, keyPair: Ed25519Keypair, poolID: string, coinAAmount: number, coinBAmount: number, slippage: number, lowerPrice: number, upperPrice: number) {
    const qc = new QueryChain(client);
    const pool = await qc.getPool(poolID);

    // 1. Convert user-friendly inputs to protocol-understandable formats (BN and Ticks)
    const coinAAmountBN = new BN(toBigNumberStr(coinAAmount, pool.coin_a.decimals));
    const coinBAmountBN = new BN(toBigNumberStr(coinBAmount, pool.coin_b.decimals));
    const lowerTick = TickMath.priceToInitializableTickIndex(new Decimal(lowerPrice), pool.coin_a.decimals, pool.coin_b.decimals, pool.ticks_manager.tick_spacing);
    const upperTick = TickMath.priceToInitializableTickIndex(new Decimal(upperPrice), pool.coin_a.decimals, pool.coin_b.decimals, pool.ticks_manager.tick_spacing);
    const curSqrtPrice = new BN(pool.current_sqrt_price);

    // 2. Estimate the maximum liquidity that can be provided with the given token amounts.
    // This is the key step for a rebalanced wallet.
    const liquidityAmount = ClmmPoolUtil.estimateLiquidityFromCoinAmounts(
        curSqrtPrice,
        lowerTick,
        upperTick,
        { coinA: coinAAmountBN, coinB: coinBAmountBN },
    );

    // 3. Based on the calculated liquidity, get the exact coin amounts required.
    const lowerSqrtPriceBN = TickMath.tickIndexToSqrtPriceX64(lowerTick);
    const upperSqrtPriceBN = TickMath.tickIndexToSqrtPriceX64(upperTick);
    const coinAmounts = ClmmPoolUtil.getCoinAmountFromLiquidity(liquidityAmount, curSqrtPrice, lowerSqrtPriceBN, upperSqrtPriceBN, true);

    // 4. Prepare the final parameters for the on-chain call, including slippage protection.
    const liquidityInput: ILiquidityParams = {
        lowerPrice,
        upperPrice,
        lowerPriceX64: lowerSqrtPriceBN,
        upperPriceX64: upperSqrtPriceBN,
        lowerTick,
        upperTick,
        liquidity: liquidityAmount.toNumber(),
        coinAmounts: coinAmounts,
        minCoinAmounts: { // Apply slippage to get minimum acceptable amounts
            coinA: new BN(new Decimal(coinAmounts.coinA.toString()).mul(1 - (slippage / 100)).floor().toString()),
            coinB: new BN(new Decimal(coinAmounts.coinB.toString()).mul(1 - (slippage / 100)).floor().toString()),
        }
    };

    console.log("Calculated liquidity input:", {
        liquidity: liquidityInput.liquidity,
        coinAAmount: liquidityInput.coinAmounts.coinA.toString(),
        coinBAmount: liquidityInput.coinAmounts.coinB.toString(),
        minCoinA: liquidityInput.minCoinAmounts.coinA.toString(),
        minCoinB: liquidityInput.minCoinAmounts.coinB.toString(),
    });

    const oc = new OnChainCalls(client, mainnet, { signer: keyPair });
    // Note: We use `openPositionWithLiquidity` which is more suitable for this scenario.
    const resp = await oc.openPositionWithLiquidity(pool, liquidityInput);
    return resp;
}

///  provide liquidity to an existing position.
/// A position can be opened by using either openPosition() or openPositionWithFixedAmount(). 
/// Parameters:
/// - privateKey        : The private key of the user making the blockchain call
/// - posID             : The position ID of the position whose liquidity is being provided
/// - coinAmount		    : The amount of CoinA willing to provide 
///                       This should be a decimal such as 1.7 as the decimal places are handled internally
/// - slippage			    : The difference between the expected price of a trade and the actual price at which it is executed.
///						            This should be a number between 0 and 1, eg: 0.2
/// await provideLiquidityWithFixedAmount("<private key>","0xdfb915d248674db372adfc3caba299bf0ce2ed216a6475498eabbd28c92b6c84", 1, 0.5)
export async function provideLiquidityWithFixedAmount(client: SuiClient, keyPair: Ed25519Keypair, posID: string, coinAmount: number, slippage: number) {
    // const keyPair = Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));

    let qc = new QueryChain(client);
    let pos = await qc.getPositionDetails(posID)
    let pool = await qc.getPool(pos.pool_id);

    let coinAmountBN = new BN(toBigNumberStr(coinAmount, pool.coin_a.decimals));

    const curSqrtPrice = new BN(pool.current_sqrt_price);
    const fix_amount_a = true;
    let roundUp = true;

    const liquidityInput = ClmmPoolUtil.estLiquidityAndCoinAmountFromOneAmounts(
        pos.lower_tick,
        pos.upper_tick,
        coinAmountBN,
        fix_amount_a,
        roundUp,
        slippage,
        curSqrtPrice
    );
    console.log(liquidityInput);
    let oc = new OnChainCalls(client, mainnet, { signer: keyPair });
    let resp = await oc.provideLiquidityWithFixedAmount(pool, posID, liquidityInput);
    return resp
}

/// remove liquidity from an existing postion.
/// Parameters:
/// - privateKey        : The private key of the user making the blockchain call
/// - posID             : The position ID of the position whose liquidity is being removed
/// - coinAmount		    : The amount of CoinA willing to provide 
///                       This should be a decimal such as 1.7 as the decimal places are handled internally
/// - slippage			    : The difference between the expected price of a trade and the actual price at which it is executed.
///						            This should be a number between 0 and 1, eg: 0.2
/// await removeLiquidity("<private key>","0xdfb915d248674db372adfc3caba299bf0ce2ed216a6475498eabbd28c92b6c84", 1, 0.5)
export async function removeLiquidity(client: SuiClient, keyPair: Ed25519Keypair, posID: string, coinAmount: number, slippage: number) {
    // const keyPair = Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
    let oc = new OnChainCalls(client, mainnet, { signer: keyPair });
    let qc = new QueryChain(client);

    let pos = await qc.getPositionDetails(posID)
    let pool = await qc.getPool(pos.pool_id);

    let coinAmountBN = new BN(toBigNumberStr(coinAmount, pool.coin_a.decimals));
    const curSqrtPrice = new BN(pool.current_sqrt_price);
    let fix_amount_a = true;
    let roundUp = false;

    const liquidityInput = ClmmPoolUtil.estLiquidityAndCoinAmountFromOneAmounts(
        pos.lower_tick,
        pos.upper_tick,
        coinAmountBN,
        fix_amount_a,
        roundUp,
        slippage,
        curSqrtPrice
    );

    let resp = await oc.removeLiquidity(pool, posID, liquidityInput);
    return resp
}

///  view the current fees and rewards for a given position.
/// Parameters:
/// - privateKey        : The private key of the user making the blockchain call
/// - posID             : The position ID of the position whose fee and rewards are being queried
/// await getAccruedFeeAndRewards("<private key>","0x202ca4622f4902d671b37ba8d65fd0418351ce5ac7e7e432ddff13c2236333d1")
export async function getAccruedFeeAndRewards(client: SuiClient, keyPair: Ed25519Keypair, posID: string) {
    let qc = new QueryChain(client);
    // const keyPair = Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));

    let oc = new OnChainCalls(client, mainnet, { signer: keyPair });

    let pos = await qc.getPositionDetails(posID);
    let pool = await qc.getPool(pos.pool_id);
    let resp = await oc.getAccruedFeeAndRewards(pool, posID);

    return {
        "rewards": resp.rewards,
        "fee": {
            "coinA": resp.fee.coinA.toString(),
            "coinB": resp.fee.coinB.toString(),
        }
    }
}

/// receive all the accrued fees related to a specific position.
/// Parameters:
/// - privateKey        : The private key of the user making the blockchain call
/// - posID             : The position ID of the position whose fee is being collected
/// await collectFee("<private key>","0xdfb915d248674db372adfc3caba299bf0ce2ed216a6475498eabbd28c92b6c84")

export async function collectFee(client: SuiClient, keyPair: Ed25519Keypair, posID: string) {
    // const keyPair = Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));

    let oc = new OnChainCalls(client, mainnet, { signer: keyPair });
    let qc = new QueryChain(client);

    let pos = await qc.getPositionDetails(posID);
    let pool = await qc.getPool(pos.pool_id);
    let resp = await oc.collectFee(pool, posID);
    return resp
}

///  collect the rewards of a specific position.
/// Parameters:
/// - privateKey        : The private key of the user making the blockchain call
/// - posID             : The position ID of the position whose rewards are being collected
/// await collectRewards("<private key>","0xdfb915d248674db372adfc3caba299bf0ce2ed216a6475498eabbd28c92b6c84")
export async function collectRewards(client: SuiClient, keyPair: Ed25519Keypair, posID: string) {
    let qc = new QueryChain(client);
    // const keyPair = Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));

    let oc = new OnChainCalls(client, mainnet, { signer: keyPair });

    let pos = await qc.getPositionDetails(posID);
    let pool = await qc.getPool(pos.pool_id);
    let resp = await oc.collectRewards(pool, posID);

    return resp;
}

/// collect the fees and the rewards of a specific position
/// Parameters:
/// - privateKey        : The private key of the user making the blockchain call
/// - posID             : The position ID of the position whose fee and rewards are being collected
/// await collectFeeAndRewards("<private key>","0xdfb915d248674db372adfc3caba299bf0ce2ed216a6475498eabbd28c92b6c84")

export async function collectFeeAndRewards(client: SuiClient, keyPair: Ed25519Keypair, posID: string) {
    // const keyPair = Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));

    let oc = new OnChainCalls(client, mainnet, { signer: keyPair });
    let qc = new QueryChain(client);

    let pos = await qc.getPositionDetails(posID);
    let pool = await qc.getPool(pos.pool_id);
    let resp = await oc.collectFeeAndRewards(pool, posID);
    return resp
}

///  close a position, claiming the entire liquidity amount, the fees and the rewards in the process.
/// Parameters:
/// - privateKey        : The private key of the user making the blockchain call
/// - posID             : The position ID of the position that is being closed
/// await closePosition("<private key>","0xdfb915d248674db372adfc3caba299bf0ce2ed216a6475498eabbd28c92b6c84")

export async function closePosition(client: SuiClient, keyPair: Ed25519Keypair, posID: string) {
    // const keyPair = Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));

    let oc = new OnChainCalls(client, mainnet, { signer: keyPair });
    let qc = new QueryChain(client);

    let pos = await qc.getPositionDetails(posID);
    let pool = await qc.getPool(pos.pool_id);
    let resp = await oc.closePosition(pool, posID);
    return resp
}

// retrieve the amount of coinB to be received when swapped for coinA
// Let's assume we're trading on the SUI-USDC pool:
// aToB	byAmountIn	Result
// TRUE	TRUE	Trading SUI for USDC by specifying the amount of SUI to put in
// TRUE	FALSE	Trading SUI for USDC by specifying the amount of USDC you require
// FALSE	TRUE	Trading USDC for SUI by specifying the amount USDC to put in
// FALSE	FALSE	Trading USDC for SUI by specifying the amount of SUI you require
/// Parameters:
/// - privateKey        : The private key of the user making the blockchain call
/// - poolID            : The id of the the pool ex: 0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa 
/// - amount            : The amount of coinA you're swapping
/// - aToB              : If true, then the swap is coinA -> coinB
///                       if false then the swap is coinB -> coinA
/// - byAmountIn        : If true, then you're specifying the amount you're putting in
///                       If false, then you're specifying the amount you're getting back
/// - slippage			    : The difference between the expected price of a trade and the actual price at which it is executed.
///						            This should be a number between 0 and 1, eg: 0.2     
/// computeSwapResults("<private_key>","0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa", 1, true, true, 0.1,)
/// .then((resp) => console.log(JSON.stringify(resp)))
//// .catch((err) => console.error("Error: ", err));

export async function computeSwapResults(client: SuiClient, keyPair: Ed25519Keypair, poolID: string, amount: number, aToB: boolean, byAmountIn: boolean, slippage: number) {
    // const keyPair = Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));

    let oc = new OnChainCalls(client, mainnet, { signer: keyPair });
    let qc = new QueryChain(client);

    let poolState = await qc.getPool(poolID);

    let iSwapParams: ISwapParams = {
        pool: poolState,
        amountIn: byAmountIn == true ? toBigNumber(amount, (aToB == true ? poolState.coin_a.decimals : poolState.coin_b.decimals)) : 0,
        amountOut: byAmountIn == true ? 0 : toBigNumber(amount, (aToB == true ? poolState.coin_b.decimals : poolState.coin_a.decimals)),
        aToB: aToB,
        byAmountIn: byAmountIn,
        slippage: slippage
    }

    let resp = await oc.computeSwapResults(iSwapParams);
    return resp
}

export async function getEstimatedAmount(client: SuiClient, keyPair: Ed25519Keypair, poolID: string, amount: number, aToB: boolean, byAmountIn: boolean, slippage: number) {
    // const keyPair = Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));

    let oc = new OnChainCalls(client, mainnet, { signer: keyPair });
    let qc = new QueryChain(client);

    let poolState = await qc.getPool(poolID);

    let iSwapParams: ISwapParams = {
        pool: poolState,
        amountIn: byAmountIn == true ? toBigNumber(amount, (aToB == true ? poolState.coin_a.decimals : poolState.coin_b.decimals)) : 0,
        amountOut: byAmountIn == true ? 0 : toBigNumber(amount, (aToB == true ? poolState.coin_b.decimals : poolState.coin_a.decimals)),
        aToB: aToB,
        byAmountIn: byAmountIn,
        slippage: slippage
    }

    // 调用 getEstimatedAmount 并根据输出代币的精度进行格式化
    const estimatedAmountRaw = await oc.getEstimatedAmount(iSwapParams);
    const outputCoinDecimals = aToB ? poolState.coin_b.decimals : poolState.coin_a.decimals;
    const estimatedAmount = new Decimal(estimatedAmountRaw).div(10 ** outputCoinDecimals).toNumber();
    return { estimatedAmount };
}

// Wrap an asset for another asset on a specific pool.
// Let's assume we're trading on the SUI-USDC pool:
// aToB	byAmountIn	Result
// TRUE	TRUE	Trading SUI for USDC by specifying the amount of SUI to put in
// TRUE	FALSE	Trading SUI for USDC by specifying the amount of USDC you require
// FALSE	TRUE	Trading USDC for SUI by specifying the amount USDC to put in
// FALSE	FALSE	Trading USDC for SUI by specifying the amount of SUI you require
// /// Parameters:
/// - privateKey        : The private key of the user making the blockchain call
/// - poolID            : The id of the the pool ex: 0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa 
/// - amount            : The amount of coinA you're swapping
/// - aToB              : If true, then the swap is coinA -> coinB
///                       if false then the swap is coinB -> coinA
/// - byAmountIn        : If true, then you're specifying the amount you're putting in
///                       If false, then you're specifying the amount you're getting back
/// - slippage			: The difference between the expected price of a trade and the actual price at which it is executed.
///						  This should be a number between 0 and 1, eg: 0.2                
/// swapAssets("<private_key>","0x0c89fd0320b406311c05f1ed8c4656b4ab7ed14999a992cc6c878c2fad405140", 1, true, true, 0.1)
///     .then((resp) => console.log(JSON.stringify(resp)))
///     .catch((err) => console.error("Error: ", err));
export async function swapAssets(client: SuiClient, keyPair: Ed25519Keypair, poolID: string, amount: number, aToB: boolean, byAmountIn: boolean, slippage: number) {

    let oc = new OnChainCalls(client, mainnet, { signer: keyPair });
    let qc = new QueryChain(client);

    let poolState = await qc.getPool(poolID);

    let iSwapParams: ISwapParams = {
        pool: poolState,
        amountIn: byAmountIn == true ? toBigNumber(amount, (aToB == true ? poolState.coin_a.decimals : poolState.coin_b.decimals)) : 0,
        amountOut: byAmountIn == true ? 0 : toBigNumber(amount, (aToB == true ? poolState.coin_b.decimals : poolState.coin_a.decimals)),
        aToB: aToB,
        byAmountIn: byAmountIn,
        slippage: slippage
    }

    let resp = await oc.swapAssets(iSwapParams);
    return resp
}

/// Dynamically adjust a position based on the current market conditions.
/// This function can be used to implement strategies such as rebalancing or adjusting the range of the position based on market movements.
/// It can be used to automatically adjust the position's lower and upper ticks based on the current price and market conditions.
/// This is a placeholder function and should be implemented with the actual logic for dynamic adjustment based on your specific requirements.
/// Parameters:
/// - posID           : The unique ID of the position being queried
export async function dynamicAdjustPosition(client: SuiClient, posID: string) {
    // TODO:
    // let qc = new QueryChain(client);
    // let pos = await qc.getPositionDetails(posID);
    // // Here you can implement the logic to dynamically adjust the position based on your requirements
    // return pos

}

```
  
# Task5
阅读并理解[Gateway测试说明文档](./test/README.md)，为bluefin clmm connector添加相关测试
## bluefin测试结构请参考raydium测试结构，尽量保持风格一致