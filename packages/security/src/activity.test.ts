import { describe, expect, it } from 'vitest';
import { summarizeTransfers, type TransferRecord } from './activity';

const USER = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
const OTHER = '0x0000000000000000000000000000000000000001';
const REGISTERED = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const UNKNOWN = '0x00000000000000000000000000000000000000AA';

function t(partial: Partial<TransferRecord>): TransferRecord {
  return {
    token: REGISTERED,
    from: OTHER,
    to: USER,
    value: 1n,
    blockNumber: 100n,
    txHash: '0xhash1',
    logIndex: 0,
    ...partial,
  };
}

describe('summarizeTransfers', () => {
  it('classifies direction case-insensitively', () => {
    const { items } = summarizeTransfers(
      [
        t({ txHash: '0xa', from: OTHER, to: USER.toUpperCase().replace('0X', '0x') }),
        t({ txHash: '0xb', from: USER.toLowerCase(), to: OTHER }),
        t({ txHash: '0xc', from: USER, to: USER }),
      ],
      USER,
      [REGISTERED],
    );
    expect(items.map((i) => i.direction).sort()).toEqual(['in', 'out', 'self']);
  });

  it('drops transfers that do not involve the user', () => {
    const { items } = summarizeTransfers([t({ from: OTHER, to: OTHER })], USER, [REGISTERED]);
    expect(items).toHaveLength(0);
  });

  it('de-duplicates by txHash + logIndex', () => {
    const dup = t({ txHash: '0xsame', logIndex: 3 });
    const { items } = summarizeTransfers([dup, { ...dup }], USER, [REGISTERED]);
    expect(items).toHaveLength(1);
  });

  it('sorts newest-first by block, then logIndex', () => {
    const { items } = summarizeTransfers(
      [
        t({ txHash: '0xa', blockNumber: 100n, logIndex: 1 }),
        t({ txHash: '0xb', blockNumber: 200n, logIndex: 0 }),
        t({ txHash: '0xc', blockNumber: 100n, logIndex: 5 }),
      ],
      USER,
      [REGISTERED],
    );
    expect(items.map((i) => i.txHash)).toEqual(['0xb', '0xc', '0xa']);
  });

  it('marks registry membership case-insensitively and quarantines the rest', () => {
    const { items, quarantined } = summarizeTransfers(
      [
        t({ txHash: '0xa', token: REGISTERED.toLowerCase() }),
        t({ txHash: '0xb', token: UNKNOWN, blockNumber: 50n }),
        t({ txHash: '0xc', token: UNKNOWN, blockNumber: 70n }),
      ],
      USER,
      [REGISTERED],
    );
    expect(items.find((i) => i.txHash === '0xa')?.registered).toBe(true);
    expect(items.filter((i) => !i.registered)).toHaveLength(2);
    expect(quarantined).toHaveLength(1);
    expect(quarantined[0]?.transferCount).toBe(2);
    expect(quarantined[0]?.lastBlock).toBe(70n);
  });

  it('returns empty structures for empty input', () => {
    const s = summarizeTransfers([], USER, []);
    expect(s.items).toHaveLength(0);
    expect(s.quarantined).toHaveLength(0);
  });
});
