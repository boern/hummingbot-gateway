# Task1: 
阅读并理解README中关于[添加新链 (Adding a New Chain)](./README.md#adding-a-new-chain)的章节
# Task2 
安装sui依赖，熟悉[sui ts-sdk代码](../sui-ts-sdk)
```bash
pnpm i @mysten/sui
```

# Task3 
按照gateway文档说明，为sui chain，搭建脚手架，创建必要的文件夹和文件
## sui chain 的工程结构可以参考solana chain的工程结构，两者非常类似
```bash
$ tree src/chains/solana/
src/chains/solana/
├── routes
│   ├── balances.ts
│   ├── estimate-gas.ts
│   ├── poll.ts
│   └── status.ts
├── schemas.ts
├── solana.config.ts
├── solana-ledger.ts
├── solana.routes.ts
├── solana.ts
└── solana.utils.ts
```
## 创建 Sui 链的默认配置文件和网络配置文件。
根据 README.md 的指导，新链需要定义自己的配置。这通常包括：
- 在 src/templates/namespace/ 目录下为 Sui 链添加 sui-schema.json 和 sui-network-schema.json。
- 在 src/templates/chains/ 目录下创建 sui.yml 作为链的默认配置。
- 在 src/templates/chains/sui/ 目录下为支持的每个网络（如 mainnet, testnet）创建对应的 yml 配置文件。
- 其他配置
  
## 在 Gateway 的路由中注册新的 Sui 链。
为了让 Gateway 的 API 能够识别和调用到 Sui 链的实现，需要在 src/chains/chain.routes.ts 文件中导入并注册 Sui 链模块。

# Task4
为Sui chain实现相关routes以及方法:

## Task4-1 在walletRoutes添加对sui wallet的支持。
getWallet/addWallet/addHardwareWallet/removeWallet/setDefaultWallet

## Task4-2 在tokensRoutes中添加对sui tokens的支持
在 src/templates/tokens/sui/ 目录下为支持的网络提供默认的 json 代币列表文件。
listTokens/getToken/addToken/removeToken

## Task4-3 实现sui chain的statusRoute以及相关方法

### 获取Sui网络状态可以通过查询最新检查点（checkpoint）的序列号来实现，这类似于其他区块链中的“区块高度”。
可以参考Sui TS SDK中的`getLatestCheckpointSequenceNumber`方法。

```typescript
async getLatestCheckpointSequenceNumber({ signal }: GetLatestCheckpointSequenceNumberParams = {}): Promise<string>
```

## Task4-4 实现sui chain的estimateGasRoute以及相关方法
Estimate gas prices for Sui transactions
### Sui的Gas机制比较独特。我们可以通过getReferenceGasPrice获取当前epoch的参考Gas价格。 
可以参考Sui TS SDK中的getReferenceGasPrice方法。 
```typescript 
async getReferenceGasPrice({ signal }: GetReferenceGasPriceParams = {}): Promise<bigint>
```

## Task4-5 实现sui chain的balancesRoute以及相关方法
Get token balances for a Sui address.
### 获取一个Sui地址的代币余额，可以使用getAllBalances方法来获取该地址拥有的所有代币的余额。 
可以参考Sui TS SDK中的getAllBalances方法。 
```typescript 
async getAllBalances(input: GetAllBalancesParams): Promise<CoinBalance[]> 
```

## Task4-6 实现sui chain的pollRoute以及相关方法
Poll for the status of a Sui transaction
### 轮询Sui交易的状态可以通过交易摘要（digest）来实现。我们可以使用getTransactionBlock方法来获取交易的详细信息和状态。 
可以参考Sui TS SDK中的getTransactionBlock方法。 
```typescript 
async getTransactionBlock(input: GetTransactionBlockParams): Promise<SuiTransactionBlockResponse>
```

# Task5
阅读并理解[Gateway测试说明文档](./test/README.md)，为新链添加相关测试
