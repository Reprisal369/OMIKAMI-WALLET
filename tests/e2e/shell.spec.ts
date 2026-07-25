import { expect, test } from '@playwright/test';
import {
  TEST_ADDRESS,
  MAINNET_HEX,
  connectWallet,
  installMockWallet,
  interceptRpc,
} from './helpers';

test.describe('OMIKAMI WALLET — read-only shell', () => {
  test('1. disconnected state without any wallet', async ({ page }) => {
    await interceptRpc(page);
    await page.goto('/');
    await expect(page.getByText('No injected wallet detected')).toBeVisible();
    await expect(page.getByRole('button', { name: /connect/i })).toBeDisabled();
  });

  test('2. connect button is enabled when a wallet is present', async ({ page }) => {
    await installMockWallet(page);
    await interceptRpc(page);
    await page.goto('/');
    const button = page.getByRole('button', { name: /connect/i }).first();
    await expect(button).toBeEnabled();
    await expect(page.getByText('No injected wallet detected')).toHaveCount(0);
  });

  test('3. user rejection shows a safe, non-alarming message', async ({ page }) => {
    await installMockWallet(page, { rejectConnect: true });
    await interceptRpc(page);
    await page.goto('/');
    await connectWallet(page);
    await expect(page.getByText(/you rejected the connection request/i)).toBeVisible();
    await expect(page.getByText(/nothing was signed/i)).toBeVisible();
  });

  test('4+5+6. successful connection shows checksummed address and Sepolia chain id', async ({
    page,
  }) => {
    await installMockWallet(page);
    await interceptRpc(page);
    await page.goto('/');
    await connectWallet(page);
    await expect(page.getByTitle(TEST_ADDRESS)).toBeVisible();
    await expect(page.getByText('Chain ID 11155111').first()).toBeVisible();
    await expect(page.getByText('Testnet', { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disconnect wallet' })).toBeVisible();
  });

  test('7. wrong-network warning on mainnet, without auto-switching', async ({ page }) => {
    await installMockWallet(page, { chainIdHex: MAINNET_HEX });
    await interceptRpc(page);
    await page.goto('/');
    await connectWallet(page);
    await expect(page.getByText(/which this read-only build does not support/i)).toBeVisible();
    await expect(page.getByText(/never switches networks for you/i).first()).toBeVisible();
  });

  test('8. native balance renders from the (mocked) RPC', async ({ page }) => {
    const seen: string[] = [];
    await installMockWallet(page);
    await interceptRpc(page, 'ok', seen);
    await page.goto('/');
    await connectWallet(page);
    await expect(page.getByRole('button', { name: 'Disconnect wallet' })).toBeVisible();
    // Diagnostic step: the balance query must actually reach the mocked RPC.
    await expect
      .poll(() => seen.includes('eth_getBalance') || seen.includes('eth_call'), {
        timeout: 10_000,
        message: `no balance read reached the RPC mock; methods seen: [${seen.join(', ')}]`,
      })
      .toBe(true);
    // toContainText prints the ACTUAL row text on failure — shows whether the
    // UI is stuck on Loading…, an error message, or a different amount.
    await expect(page.locator('main dl').first()).toContainText(/0\.05\s*ETH/, {
      timeout: 15_000,
    });
  });

  test('9. RPC timeout / unreachable shows the error state with retry', async ({ page }) => {
    await interceptRpc(page, 'timeout');
    await page.goto('/');
    await expect(page.getByText(/unreachable or timed out/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /retry/i }).first()).toBeVisible();
  });

  test('10. malformed RPC response shows the error state, never fake data', async ({ page }) => {
    await interceptRpc(page, 'malformed');
    await page.goto('/');
    await expect(page.getByText(/unreachable or timed out/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/latest block/i)).toHaveCount(0);
  });

  test('11. disconnect returns to the disconnected state', async ({ page }) => {
    await installMockWallet(page);
    await interceptRpc(page);
    await page.goto('/');
    await connectWallet(page);
    await page.getByRole('button', { name: 'Disconnect wallet' }).click();
    await expect(page.getByRole('button', { name: /connect/i }).first()).toBeVisible();
    await expect(page.getByTitle(TEST_ADDRESS)).toHaveCount(0);
  });

  test('12. refresh keeps nothing: no session survives, no browser storage written', async ({
    page,
  }) => {
    await installMockWallet(page);
    await interceptRpc(page);
    await page.goto('/');
    await connectWallet(page);
    await expect(page.getByRole('button', { name: 'Disconnect wallet' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: /connect/i }).first()).toBeVisible();
    await expect(page.getByTitle(TEST_ADDRESS)).toHaveCount(0);
    const walletKeys = await page.evaluate(
      "JSON.stringify([...Object.keys(window.localStorage), ...Object.keys(window.sessionStorage)].filter((k) => /wagmi|omikami|wallet|account|address/i.test(k)))",
    );
    expect(JSON.parse(walletKeys as string)).toEqual([]);
  });

  test('13+14. layout renders core panels in this viewport', async ({ page }) => {
    await installMockWallet(page);
    await interceptRpc(page);
    await page.goto('/');
    await expect(page.getByText(/omikami shield/i).first()).toBeVisible();
    await expect(page.getByText(/rpc connection/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /connect/i }).first()).toBeVisible();
    const overflow = await page.evaluate(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth',
    );
    expect(Number(overflow)).toBeLessThanOrEqual(1);
  });

  test('15. read-only invariant: no transaction or credential surface exists', async ({ page }) => {
    await installMockWallet(page);
    await interceptRpc(page);
    await page.goto('/');
    await connectWallet(page);
    // Scope to <main>: the assertion is about OUR application surface, not
    // the Next.js dev-overlay widget that mounts outside it in dev mode.
    const app = page.locator('main');
    await expect(app.locator('textarea')).toHaveCount(0);
    // Exactly three text inputs exist, all non-credential: the Settings
    // RPC-URL field (type=url) and the Transfer-preview recipient + amount
    // fields (type=text). None can capture a password, key file, or seed.
    await expect(app.locator('input')).toHaveCount(3);
    await expect(app.locator('input[type="url"]')).toHaveCount(1);
    await expect(app.locator('input[type="text"]')).toHaveCount(2);
    await expect(app.locator('input[type="password"], input[type="file"]')).toHaveCount(0);
    // No actionable transaction/credential control of ANY kind. The preview
    // panel is deliberately button-free: it cannot sign or send.
    await expect(
      app.getByRole('button', {
        name: /send|approve|permit|sign|swap|bridge|stake|staking|deploy|import|seed|private key|keystore/i,
      }),
    ).toHaveCount(0);
    await expect(page.getByText(/never ask for (a|your) seed phrase/i).first()).toBeVisible();
  });

  test('16. token panel shows the verified USDC entry read-only', async ({ page }) => {
    await installMockWallet(page);
    await interceptRpc(page);
    await page.goto('/');
    await connectWallet(page);
    await expect(page.getByText(/token balances/i).first()).toBeVisible();
    await expect(page.getByText('USDC').first()).toBeVisible();
    await expect(page.getByText('Verified').first()).toBeVisible();
    // Only the Settings RPC-URL input exists; no transaction inputs.
    await expect(page.locator('main input[type="password"], main input[type="file"]')).toHaveCount(0);
  });

  test('17. activity panel reads logs and quarantine stays empty on clean history', async ({
    page,
  }) => {
    await installMockWallet(page);
    await interceptRpc(page);
    await page.goto('/');
    await connectWallet(page);
    await expect(page.getByText(/recent token activity/i).first()).toBeVisible();
    await expect(page.getByText(/no token transfers found/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/unknown token contracts \(quarantined\)/i)).toHaveCount(0);
    await expect(page.locator('main input[type="password"], main input[type="file"]')).toHaveCount(0);
  });

  test('18. Settings RPC input validates and rejects unsafe endpoints', async ({ page }) => {
    await installMockWallet(page);
    await interceptRpc(page);
    await page.goto('/');
    const input = page.locator('input[type="url"]');
    await expect(input).toBeVisible();

    // Reject a non-https / internal endpoint.
    await input.fill('http://localhost:8545');
    await page.getByRole('button', { name: /save endpoint/i }).click();
    await expect(page.getByText(/only https/i)).toBeVisible();

    // Reject a private IP.
    await input.fill('https://192.168.1.1');
    await page.getByRole('button', { name: /save endpoint/i }).click();
    await expect(page.getByText(/internal-network|not allowed/i)).toBeVisible();

    // Accept a well-formed public https endpoint.
    await input.fill('https://sepolia.example.com/rpc');
    await page.getByRole('button', { name: /save endpoint/i }).click();
    await expect(page.getByText(/saved\. reload/i)).toBeVisible();

    // Reset clears it.
    await page.getByRole('button', { name: /reset to default/i }).click();
    await expect(input).toHaveValue('');
  });

  test('19. transfer preview is read-only and has no send/sign control', async ({ page }) => {
    await installMockWallet(page);
    await interceptRpc(page);
    await page.goto('/');
    await connectWallet(page);
    const preview = page.getByText(/transfer preview \(read-only\)/i).first();
    await expect(preview).toBeVisible();
    await expect(page.getByText(/this build cannot sign or broadcast/i)).toBeVisible();
    // The panel exposes no actionable submit control.
    await expect(
      page.getByRole('button', { name: /send|sign|broadcast|submit|confirm/i }),
    ).toHaveCount(0);
  });

  test('20. preview flags a burn (zero) address and clears on a valid one', async ({ page }) => {
    await installMockWallet(page);
    await interceptRpc(page);
    await page.goto('/');
    await connectWallet(page);

    const recipient = page.getByLabel(/recipient address/i);
    const amount = page.getByLabel(/amount/i);
    await recipient.fill('0x0000000000000000000000000000000000000000');
    await amount.fill('1');
    // Target the check label exactly (the detail line also contains "zero address").
    await expect(page.getByText('Recipient is the zero address')).toBeVisible();
    await expect(page.getByText(/should not proceed with this transfer/i)).toBeVisible();

    // A normal, well-formed recipient (all-lowercase, auto-checksummed) clears the block.
    await recipient.fill('0x00000000000000000000000000000000deadbeef');
    await expect(page.getByText(/zero address/i)).toHaveCount(0);
  });

  test('21. allowance dashboard is read-only with no approve/revoke control', async ({ page }) => {
    await installMockWallet(page);
    await interceptRpc(page);
    await page.goto('/');
    await connectWallet(page);
    await expect(page.getByText(/token allowances \(read-only\)/i).first()).toBeVisible();
    // Clean history (mock returns no Approval logs) → empty state.
    await expect(page.getByText(/no active token allowances found/i)).toBeVisible({
      timeout: 15_000,
    });
    // No actionable allowance control of any kind.
    await expect(
      page.getByRole('button', { name: /approve|revoke|permit|sign|send|increase|decrease/i }),
    ).toHaveCount(0);
    await expect(page.locator('main input[type="password"], main input[type="file"]')).toHaveCount(
      0,
    );
  });

  test('keyboard navigation reaches the primary action', async ({ page }) => {
    await installMockWallet(page);
    await interceptRpc(page);
    await page.goto('/');
    const button = page.getByRole('button', { name: /connect/i }).first();
    await expect(button).toBeEnabled();
    // The dev-overlay widget adds extra tab stops outside <main>; allow a
    // generous number of Tab presses before requiring focus on the action.
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    let reached = false;
    for (let i = 0; i < 30 && !reached; i += 1) {
      await page.keyboard.press('Tab');
      reached = await button.evaluate((el) => el === document.activeElement);
    }
    expect(reached).toBe(true);
    await expect(button).toBeFocused();
  });
});
