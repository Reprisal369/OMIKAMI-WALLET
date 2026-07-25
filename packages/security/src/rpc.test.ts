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
