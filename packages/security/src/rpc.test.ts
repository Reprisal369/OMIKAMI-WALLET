import { describe, expect, it } from 'vitest';
import { rpcRejectMessage, validateRpcUrl, type RpcRejectReason } from './rpc';

describe('validateRpcUrl', () => {
  it('accepts a normal public https endpoint', () => {
    const r = validateRpcUrl('https://rpc.example.com/v1/key');
    expect(r.valid).toBe(true);
    expect(r.normalized).toContain('https://rpc.example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(validateRpcUrl('   https://sepolia.example.org   ').valid).toBe(true);
  });

  it('rejects empty input', () => {
    expect(validateRpcUrl('').reason).toBe('empty');
    expect(validateRpcUrl('   ').reason).toBe('empty');
  });

  it('rejects non-https schemes (http, ws, file, javascript, data)', () => {
    expect(validateRpcUrl('http://rpc.example.com').reason).toBe('not-https');
    expect(validateRpcUrl('ws://rpc.example.com').reason).toBe('not-https');
    expect(validateRpcUrl('file:///etc/passwd').reason).toBe('not-https');
    expect(validateRpcUrl('javascript:alert(1)').reason).toBe('not-https');
    expect(validateRpcUrl('data:text/html,x').reason).toBe('not-https');
  });

  it('rejects credentials in the URL', () => {
    expect(validateRpcUrl('https://user:pass@rpc.example.com').reason).toBe('has-credentials');
  });

  it('rejects localhost and internal hostnames', () => {
    expect(validateRpcUrl('https://localhost').reason).toBe('internal-host');
    expect(validateRpcUrl('https://foo.local').reason).toBe('internal-host');
    expect(validateRpcUrl('https://router.localhost').reason).toBe('internal-host');
  });

  it('rejects private, loopback, link-local and CGNAT IPv4', () => {
    for (const ip of [
      'https://127.0.0.1',
      'https://10.0.0.5',
      'https://172.16.4.1',
      'https://172.31.255.1',
      'https://192.168.1.1',
      'https://169.254.1.1',
      'https://100.64.0.1',
      'https://0.0.0.0',
    ]) {
      expect(validateRpcUrl(ip).reason).toBe('internal-host');
    }
  });

  it('rejects IPv6 literals', () => {
    expect(validateRpcUrl('https://[::1]').reason).toBe('internal-host');
  });

  it('rejects ALL IPv6 literals incl. public ones (fails closed, documented L3/I4)', () => {
    expect(validateRpcUrl('https://[2606:4700:4700::1111]').reason).toBe('internal-host');
  });

  it('rejects malformed / non-parseable URLs', () => {
    expect(validateRpcUrl('https://').reason).toBe('not-a-url');
    expect(validateRpcUrl('not a url at all').reason).toBe('not-a-url');
    expect(validateRpcUrl('rpc.example.com').reason).toBe('not-a-url');
  });

  it('is case-insensitive about internal hosts and strips the port first', () => {
    expect(validateRpcUrl('https://LOCALHOST').reason).toBe('internal-host');
    expect(validateRpcUrl('https://192.168.1.1:8545').reason).toBe('internal-host');
  });

  it('accepts a public host with a port and preserves path + query when normalizing', () => {
    const r = validateRpcUrl('https://rpc.example.com:8545/v1/key?net=sepolia');
    expect(r.valid).toBe(true);
    expect(r.normalized).toBe('https://rpc.example.com:8545/v1/key?net=sepolia');
  });

  it('rejects bare hostnames without a dot', () => {
    expect(validateRpcUrl('https://intranet').reason).toBe('not-public');
  });

  it('provides a message for every reason', () => {
    const reasons: RpcRejectReason[] = [
      'empty',
      'not-a-url',
      'not-https',
      'has-credentials',
      'internal-host',
      'not-public',
    ];
    for (const r of reasons) {
      expect(rpcRejectMessage(r).length).toBeGreaterThan(5);
    }
  });
});
