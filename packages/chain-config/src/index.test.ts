import { describe, expect, it } from 'vitest';
import {
  CHAIN_REGISTRY,
  DEFAULT_CHAIN_ID,
  chainMetaSchema,
  chainDisplayName,
  explorerAddressUrl,
  explorerTxUrl,
  getChainMeta,
  isSupportedChain,
  transactionsEnabled,
} from './index';

describe('chain registry', () => {
  it('validates against the schema', () => {
    for (const entry of CHAIN_REGISTRY) {
      expect(() => chainMetaSchema.parse(entry)).not.toThrow();
    }
  });

  it('uses Sepolia (11155111) as the default development chain', () => {
    expect(DEFAULT_CHAIN_ID).toBe(11155111);
    const meta = getChainMeta(DEFAULT_CHAIN_ID);
    expect(meta?.testnet).toBe(true);
    expect(meta?.enabled).toBe(true);
  });

  it('PHASE-ONE INVARIANT: transactions are disabled on every chain', () => {
    for (const entry of CHAIN_REGISTRY) {
      expect(entry.transactionsEnabled).toBe(false);
    }
    expect(transactionsEnabled(DEFAULT_CHAIN_ID)).toBe(false);
    expect(transactionsEnabled(1)).toBe(false);
  });

  it('mainnet (1) is registered for naming but not enabled', () => {
    const meta = getChainMeta(1);
    expect(meta).toBeDefined();
    expect(meta?.enabled).toBe(false);
    expect(isSupportedChain(1)).toBe(false);
  });

  it('unknown chains are unsupported and transaction-disabled', () => {
    expect(isSupportedChain(999999)).toBe(false);
    expect(transactionsEnabled(999999)).toBe(false);
    expect(getChainMeta(999999)).toBeUndefined();
    expect(chainDisplayName(999999)).toContain('999999');
  });

  it('builds explorer URLs from viem chain data only', () => {
    const zero = '0x0000000000000000000000000000000000000000';
    const url = explorerAddressUrl(DEFAULT_CHAIN_ID, zero);
    expect(url).toBeDefined();
    expect(url).toContain(`/address/${zero}`);
    expect(explorerAddressUrl(999999, zero)).toBeUndefined();
  });

  it('builds explorer tx URLs from viem chain data only', () => {
    const hash = '0x' + '0'.repeat(64);
    expect(explorerTxUrl(DEFAULT_CHAIN_ID, hash)).toContain(`/tx/${hash}`);
    expect(explorerTxUrl(999999, hash)).toBeUndefined();
  });
});
