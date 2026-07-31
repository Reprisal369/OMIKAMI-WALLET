/**
 * OMIKAMI WALLET presentational components.
 * Dark charcoal / warm gold, high contrast, no urgency styling, no bright
 * risk-hiding buttons. Security-critical actions use explicit language.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { SecurityCheckStatus } from '@omikami/types';

export function Panel({
  title,
  children,
  tone = 'default',
}: {
  title?: string;
  children: ReactNode;
  tone?: 'default' | 'gold';
}) {
  return (
    <section
      className={`rounded-xl border bg-[var(--omi-surface)] p-5 sm:p-6 ${
        tone === 'gold' ? 'border-[var(--omi-gold-dim)]' : 'border-[var(--omi-border)]'
      }`}
    >
      {title ? (
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--omi-gold)]">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

const badgeStyles: Record<SecurityCheckStatus, string> = {
  ok: 'bg-[rgba(74,164,110,0.12)] text-[var(--omi-ok)] border-[rgba(74,164,110,0.35)]',
  info: 'bg-[rgba(140,150,170,0.12)] text-[var(--omi-muted)] border-[rgba(140,150,170,0.35)]',
  warning: 'bg-[rgba(214,158,46,0.12)] text-[var(--omi-warn)] border-[rgba(214,158,46,0.45)]',
  blocked: 'bg-[rgba(200,80,80,0.12)] text-[var(--omi-danger)] border-[rgba(200,80,80,0.45)]',
};

const badgeLabel: Record<SecurityCheckStatus, string> = {
  ok: 'OK',
  info: 'Info',
  warning: 'Warning',
  blocked: 'Blocked',
};

export function StatusBadge({ status }: { status: SecurityCheckStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeStyles[status]}`}
    >
      {badgeLabel[status]}
    </span>
  );
}

export function ActionButton({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'quiet' | 'danger';
  type?: 'button' | 'submit';
}) {
  const styles = {
    primary:
      'border-[var(--omi-gold-dim)] bg-[rgba(201,162,74,0.10)] text-[var(--omi-gold)] hover:bg-[rgba(201,162,74,0.18)]',
    quiet:
      'border-[var(--omi-border)] bg-transparent text-[var(--omi-text)] hover:border-[var(--omi-muted)]',
    danger:
      'border-[rgba(200,80,80,0.45)] bg-[rgba(200,80,80,0.08)] text-[var(--omi-danger)] hover:bg-[rgba(200,80,80,0.15)]',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--omi-gold)] disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-sm text-[var(--omi-muted)]">{label}</dt>
      <dd className="text-sm text-[var(--omi-text)]">{children}</dd>
    </div>
  );
}

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-live="polite"
      aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
      className="inline-flex min-h-[24px] items-center rounded border border-[var(--omi-border)] px-2 py-0.5 text-xs text-[var(--omi-muted)] hover:text-[var(--omi-text)]"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
