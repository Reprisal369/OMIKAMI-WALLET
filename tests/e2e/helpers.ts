import type { Page } from '@playwright/test';

/** EIP-55 spec test vector — not a production address. */
export const TEST_ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
export const SEPOLIA_HEX = '0xaa36a7'; // 11155111
export const MAINNET_HEX = '0x1';
/** 0.05 ETH in wei, hex. */
export const BALANCE_HEX = '0xb1a2bc2ec50000';

export interface MockOptions {
  chainIdHex?: string;
  rejectConnect?: boolean;
}

/**
 * Installs a minimal mocked EIP-1193 provider before the app loads.
 * The mock never exposes key material — it only answers the read/connect
 * methods the shell is allowed to use.
 */
export async function installMockWallet(page: Page, opts: MockOptions = {}) {
  const { chainIdHex = SEPOLIA_HEX, rejectConnect = false } = opts;
  await page.addInitScript(
    ({ address, chainId, reject }) => {
      let connected = false;
      const listeners: Record<string, ((...a: unknown[]) => void)[]> = {};
      const provider = {
        isMetaMask: true,
        request: async ({ method }: { method: string }) => {
          switch (method) {
            case 'eth_requestAccounts':
              if (reject) {
                const err = new Error('User rejected the request.') as Error & { code: number };
                err.code = 4001;
                throw err;
              }
              connected = true;
              return [address];
            case 'eth_accounts':
              return connected ? [address] : [];
            case 'eth_chainId':
              return chainId;
            default:
              throw Object.assign(new Error(`mock: unsupported method ${method}`), { code: -32601 });
          }
        },
        on: (event: string, cb: (...a: unknown[]) => void) => {
          (listeners[event] ??= []).push(cb);
        },
        removeListener: (event: string, cb: (...a: unknown[]) => void) => {
          listeners[event] = (listeners[event] ?? []).filter((f) => f !== cb);
        },
      };
      Object.defineProperty(window, 'ethereum', { value: provider, configurable: true });
    },
    { address: TEST_ADDRESS, chainId: chainIdHex, reject: rejectConnect },
  );
}

export type RpcMode = 'ok' | 'timeout' | 'malformed';

/**
 * Intercepts ALL outgoing JSON-RPC POSTs regardless of endpoint, so tests
 * never depend on a live RPC provider. Pass `seen` to record every JSON-RPC
 * method that arrives — used for diagnostics in failing tests.
 */
export async function interceptRpc(page: Page, mode: RpcMode = 'ok', seen?: string[]) {
  await page.route('**/*', async (route) => {
    const req = route.request();
    const body = req.method() === 'POST' ? (req.postData() ?? '') : '';
    const isRpc = body.includes('"jsonrpc"');
    if (!isRpc) {
      // Let the app itself (localhost) load normally; block other GETs.
      const url = new URL(req.url());
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.fallback();
      return route.abort();
    }
    if (mode === 'timeout') return route.abort('timedout');
    if (mode === 'malformed') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: 'not-json{{{' });
    }
    // 0.05 units as a 32-byte ABI word (uint256).
    const balanceWord = '0'.repeat(50) + 'b1a2bc2ec50000';
    const word = (hex: string) => hex.padStart(64, '0');
    // Multicall3.aggregate3 return for N successful inner calls, each with a
    // 32-byte uint256 returnData. N is read from the request calldata (the
    // array length is the second ABI word after the 4-byte selector).
    const aggregate3Result = (calldata: string) => {
      const n = Math.max(1, parseInt(calldata.slice(10 + 64, 10 + 128) || '1', 16));
      const offsets = Array.from({ length: n }, (_, i) => word((n * 32 + i * 128).toString(16)));
      const elements = Array.from({ length: n }, () =>
        word('1') + word('40') + word('20') + balanceWord,
      );
      return '0x' + word('20') + word(n.toString(16)) + offsets.join('') + elements.join('');
    };
    // viem may send a single request object OR a batch array — answer both.
    const answer = (m: { id: number; method: string; params?: { data?: string }[] }) => ({
      jsonrpc: '2.0',
      id: m.id,
      result:
        m.method === 'eth_blockNumber'
          ? '0xabcdef'
          : m.method === 'eth_getLogs'
            ? []
          : m.method === 'eth_getBalance'
            ? '0xb1a2bc2ec50000'
            : m.method === 'eth_call'
              ? // wagmi reads native balance through Multicall3: aggregate3
                // (selector 0x82ad56cb) gets a full tuple; any other read
                // (e.g. getEthBalance) gets a plain uint256 word.
                m.params?.[0]?.data?.startsWith('0x82ad56cb')
                ? aggregate3Result(m.params[0].data ?? '')
                : '0x' + balanceWord
              : m.method === 'eth_chainId'
                ? '0xaa36a7'
                : '0x0',
    });
    const parsed = JSON.parse(body) as
      | { id: number; method: string }
      | { id: number; method: string }[];
    for (const m of Array.isArray(parsed) ? parsed : [parsed]) seen?.push(m.method);
    const payload = Array.isArray(parsed) ? parsed.map(answer) : answer(parsed);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });
}

export async function connectWallet(page: Page) {
  await page.getByRole('button', { name: /connect/i }).first().click();
}
