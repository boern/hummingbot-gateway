import { getSuiNetworkConfig } from '../../chains/sui/sui.config';
import { ConfigManagerV2 } from '../../services/config-manager-v2';
// import { IBluefinSpotContracts } from '@firefly-exchange/library-sui/spot';

export const mainnet = {
  GlobalConfig: '0x03db251ba509a8d5d8777b6338836082335d93eecbdd09a11e190a1cff51c352',
  ProtocolFeeCap: '0x55697473304e901372020f30228526c4e93558b23259d90bc6fdddedf83295d2',
  Display: '0x5f34ee74e113d74ae9546695af6e6d0fde51731fe8d9a71309f8e66b725d54ab',
  AdminCap: '0xc5e736b21175e1f8121d58b743432a39cbea8ee23177b6caf7c2a0aadba8d8b9',
  UpgradeCap: '0xd5b2d2159a78030e6f07e028eb75236693ed7f2f32fecbdc1edb32d3a2079c0d',
  Publisher: '0xd9810c5d1ec5d13eac8a70a059cc0087b34d245554d8704903b2492eebb17767',
  BasePackage: '0x3492c874c1e3b3e2984e8c41b589e642d4d0a5d6459e5a9cfc2d52fd7c89c267',
  CurrentPackage: '0x67b34b728c4e28e704dcfecf7c5cf55c7fc593b6c65c20d1836d97c209c1928a',
  Operators: {
    Admin: '0x37a8d55f29e5b4bdba0cb3fe0ba51a93db8c868fe0de649e1bf36bb42ea7d959',
  },
  Pools: [], // Pools are fetched dynamically, so this can be empty
};

export const testnet = {
  GlobalConfig: '',
  ProtocolFeeCap: '',
  Display: '',
  AdminCap: '',
  UpgradeCap: '',
  Publisher: '',
  BasePackage: '0x3492c874c1e3b3e2984e8c41b589e642d4d0a5d6459e5a9cfc2d52fd7c89c267', // This is often the same for testnet
  CurrentPackage: '',
  Operators: { Admin: '' },
  Pools: [],
};

export namespace BluefinConfig {
  export const config = {
    ...ConfigManagerV2.getInstance().get('bluefin'),
  };

  export const getSuiConfig = (network: string) => {
    const suiConfig = getSuiNetworkConfig(network);
    if (!suiConfig) {
      throw new Error(`Sui network ${network} is not supported`);
    }
    return suiConfig;
  };

  export const networks = ['mainnet', 'testnet'];

  export const getNetwork = (network: string) => {
    // const suiConfig = getSuiConfig(network);
    // return suiConfig.network;
    return network;
  };
}
