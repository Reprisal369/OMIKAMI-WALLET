'use client';

import { useEffect, useState } from 'react';
import { rpcRejectMessage, validateRpcUrl } from '@omikami/security';
import { ActionButton, Panel } from '@omikami/ui';
import { clearCustomRpcUrl, readCustomRpcUrl, writeCustomRpcUrl } from '@/lib/rpc-storage';

/**
 * Read-only-phase Settings: a user-configurable Sepolia RPC endpoint.
 * This is the ONLY input field in the application. The value is validated
 * (https-only, no internal hosts) before it is stored, and re-validated on
 * read. A saved change takes effect after a page reload (wagmi transport is
 * built at load time). "Reset to default" restores the built-in endpoint.
 */
export function SettingsPanel() {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    const current = readCustomRpcUrl();
    setSaved(current);
    if (current) setValue(current);
  }, []);

  function onSave() {
    setError(null);
    const check = validateRpcUrl(value);
    if (!check.valid) {
      setError(check.reason ? rpcRejectMessage(check.reason) : 'Invalid endpoint.');
      return;
    }
    if (writeCustomRpcUrl(value)) {
      setSaved(check.normalized ?? value);
      setJustSaved(true);
    } else {
      setError('Could not save the endpoint.');
    }
  }

  function onReset() {
    clearCustomRpcUrl();
    setSaved(null);
    setValue('');
    setError(null);
    setJustSaved(true);
  }

  return (
    <Panel title="Settings — custom RPC endpoint">
      <p className="mb-3 text-sm text-[var(--omi-muted)]">
        Optionally use your own Ethereum Sepolia RPC endpoint (for example your own node, or a
        provider that returns full log history). Must be a public{' '}
        <span className="font-mono">https://</span> URL. Leave blank to use the built-in default.
        This value is stored only in this browser and is never sent anywhere except as your RPC
        endpoint.
      </p>

      <label htmlFor="rpc-url" className="mb-1 block text-xs text-[var(--omi-muted)]">
        Sepolia RPC URL
      </label>
      <input
        id="rpc-url"
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        placeholder="https://your-sepolia-endpoint.example.com"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setJustSaved(false);
          setError(null);
        }}
        className="w-full rounded-lg border border-[var(--omi-border)] bg-[var(--omi-bg)] px-3 py-2 font-mono text-sm text-[var(--omi-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--omi-gold)]"
      />

      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--omi-warn)]">
          {error}
        </p>
      )}
      {justSaved && !error && (
        <p role="status" className="mt-2 text-sm text-[var(--omi-ok)]">
          Saved. Reload the page for the new endpoint to take effect.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <ActionButton onClick={onSave}>Save endpoint</ActionButton>
        <ActionButton variant="quiet" onClick={onReset} disabled={!saved && value.length === 0}>
          Reset to default
        </ActionButton>
      </div>

      <p className="mt-4 border-t border-[var(--omi-border)] pt-3 text-xs leading-relaxed text-[var(--omi-muted)]">
        A custom endpoint can see your IP address and the addresses you query, and could return
        false data. Only use an endpoint you trust. OMIKAMI WALLET validates the URL but cannot
        vouch for the operator.
      </p>
    </Panel>
  );
}
