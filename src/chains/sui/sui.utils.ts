import * as fs from 'fs';
import * as path from 'path';

import { rootPath } from '../../paths';

/**
 * Get available Sui networks from template files
 */
export function getAvailableSuiNetworks(): string[] {
  const networksPath = path.join(rootPath(), 'dist/src/templates/chains/sui');

  try {
    const files = fs.readdirSync(networksPath);
    return files.filter((file) => file.endsWith('.yml')).map((file) => file.replace('.yml', ''));
  } catch (error) {
    // Fallback to hardcoded list if directory doesn't exist
    return ['mainnet', 'testnet', 'devnet'];
  }
}
