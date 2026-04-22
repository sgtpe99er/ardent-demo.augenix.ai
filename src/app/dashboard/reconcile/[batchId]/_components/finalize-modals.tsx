'use client';

import { useEffect, useState } from 'react';
import {
  IoCardOutline,
  IoCheckmarkCircle,
  IoCloseOutline,
  IoCloudUploadOutline,
  IoLockClosed,
  IoShieldCheckmarkOutline,
} from 'react-icons/io5';

import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/utils/cn';

const money = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

// --------------------------------------------------------------------------
// Finalize modal — summary + acknowledgment checkbox
// --------------------------------------------------------------------------

interface FinalizeModalProps {
  batchId: number;
  vendorName: string;
  periodStart: string;
  periodEnd: string;
  matchRate: number | null;
  matchedCount: number;
  flaggedCount: number;
  overrideCount: number;
  netVariance: number;
  warnings: string[];
  onClose: () => void;
  onFinalized: () => void;
}

export function FinalizeModal({
  batchId,
  vendorName,
  periodStart,
  periodEnd,
  matchRate,
  matchedCount,
  flaggedCount,
  overrideCount,
  netVariance,
  warnings,
  onClose,
  onFinalized,
}: FinalizeModalProps) {
  const { toast } = useToast();
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);

  async function finalize() {
    setSaving(true);
    try {
      const res = await fetch(`/api/reconcile/${batchId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      onFinalized();
    } catch (err) {
      toast({
        variant: 'destructive',
        description: `Finalize failed: ${(err as Error).message}`,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell onClose={saving ? undefined : onClose} title='Finalize batch' subtitle={vendorName}>
      <div className='space-y-4 px-5 py-4 text-sm'>
        <p className='text-on-surface-variant dark:text-neutral-400'>
          This will finalize the statement for <strong className='text-on-surface dark:text-white'>{vendorName}</strong> and mark these invoices
          ready for payment. You can un-finalize later if you need to make edits.
        </p>

        <div className='rounded-sm border border-zinc-200 bg-zinc-50 p-4 text-xs dark:border-zinc-800 dark:bg-zinc-900'>
          <div className='mb-2 font-medium uppercase tracking-wider text-on-surface-variant dark:text-neutral-400'>
            Summary
          </div>
          <dl className='grid grid-cols-2 gap-y-1.5 text-on-surface dark:text-white'>
            <dt className='text-on-surface-variant dark:text-neutral-400'>Period</dt>
            <dd className='text-right font-mono'>
              {periodStart} → {periodEnd}
            </dd>
            <dt className='text-on-surface-variant dark:text-neutral-400'>Match rate</dt>
            <dd className='text-right font-mono'>
              {matchRate != null ? `${matchRate.toFixed(1)}%` : '—'}
            </dd>
            <dt className='text-on-surface-variant dark:text-neutral-400'>Matched lines</dt>
            <dd className='text-right font-mono'>{matchedCount}</dd>
            <dt className='text-on-surface-variant dark:text-neutral-400'>Flagged lines</dt>
            <dd
              className={cn(
                'text-right font-mono',
                flaggedCount > 0 && 'font-semibold text-amber-700 dark:text-amber-300'
              )}
            >
              {flaggedCount}
            </dd>
            <dt className='text-on-surface-variant dark:text-neutral-400'>Human overrides</dt>
            <dd className='text-right font-mono'>{overrideCount}</dd>
            <dt className='text-on-surface-variant dark:text-neutral-400'>Net variance</dt>
            <dd
              className={cn(
                'text-right font-mono',
                Math.abs(netVariance) > 0.005 &&
                  'font-semibold text-amber-700 dark:text-amber-300'
              )}
            >
              {money(netVariance)}
            </dd>
          </dl>
        </div>

        {warnings.length > 0 && (
          <div className='rounded-sm border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/30'>
            <div className='mb-1 font-medium text-amber-900 dark:text-amber-200'>
              Remaining warnings
            </div>
            <ul className='list-disc pl-5 text-amber-900 dark:text-amber-200'>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <label className='flex cursor-pointer items-start gap-2 rounded-sm border border-zinc-200 p-3 text-on-surface dark:border-zinc-800 dark:text-white'>
          <input
            type='checkbox'
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className='mt-0.5 h-4 w-4 accent-on-surface dark:accent-white'
          />
          <span className='text-sm'>I have reviewed all oddities and human overrides.</span>
        </label>
      </div>

      <footer className='flex justify-end gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800'>
        <button
          type='button'
          onClick={onClose}
          disabled={saving}
          className='rounded-sm border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-on-surface hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900'
        >
          Cancel
        </button>
        <button
          type='button'
          onClick={finalize}
          disabled={!acknowledged || saving}
          className='inline-flex items-center gap-2 rounded-sm bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50'
        >
          <IoLockClosed className='h-4 w-4' />
          {saving ? 'Finalizing…' : 'Finalize batch'}
        </button>
      </footer>
    </ModalShell>
  );
}

// --------------------------------------------------------------------------
// Sync-to-Nexsyis modal — simulated streaming write-back
// --------------------------------------------------------------------------

const SYNC_STEPS = [
  { key: 'lock', label: 'Locking reconciled batch' },
  { key: 'adjust', label: 'Applying adjustments & credits' },
  { key: 'link', label: 'Linking statement document (Imaging)' },
  { key: 'ap', label: 'Updating vendor AP records' },
  { key: 'done', label: 'Marking invoices ready-to-pay' },
];

interface SyncToNexsyisModalProps {
  batchId: number;
  vendorName: string;
  invoiceCount: number;
  onClose: () => void;
  onSynced: () => void;
}

export function SyncToNexsyisModal({
  batchId,
  vendorName,
  invoiceCount,
  onClose,
  onSynced,
}: SyncToNexsyisModalProps) {
  const { toast } = useToast();
  const [stepIdx, setStepIdx] = useState(-1);
  const [syncId, setSyncId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle');

  useEffect(() => {
    if (phase !== 'running') return;
    if (stepIdx >= SYNC_STEPS.length - 1) return;
    const timer = setTimeout(() => setStepIdx((i) => i + 1), 450);
    return () => clearTimeout(timer);
  }, [phase, stepIdx]);

  async function startSync() {
    setPhase('running');
    setStepIdx(0);
    try {
      // Kick off the real (fake) server call in parallel with the animation.
      const resPromise = fetch(`/api/reconcile/${batchId}/sync-to-nexsyis`, {
        method: 'POST',
      });
      // Let the animation progress through all steps (≈2.2s).
      await new Promise((r) => setTimeout(r, 450 * SYNC_STEPS.length));
      const res = await resPromise;
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { nexsyis_sync_id: string };
      setSyncId(data.nexsyis_sync_id);
      setStepIdx(SYNC_STEPS.length - 1);
      setPhase('done');
    } catch (err) {
      setPhase('error');
      toast({ variant: 'destructive', description: `Sync failed: ${(err as Error).message}` });
    }
  }

  return (
    <ModalShell
      onClose={phase === 'running' ? undefined : onClose}
      title='Sync to Nexsyis'
      subtitle={vendorName}
    >
      <div className='space-y-4 px-5 py-4 text-sm'>
        {phase === 'idle' && (
          <div className='rounded-sm bg-zinc-50 p-4 text-on-surface-variant dark:bg-zinc-900 dark:text-neutral-300'>
            This will push the finalized reconciliation back to Nexsyis, apply adjustments,
            link the statement document, and mark{' '}
            <strong className='text-on-surface dark:text-white'>{invoiceCount} invoices</strong>{' '}
            ready-to-pay in the vendor&rsquo;s AP ledger.
            <p className='mt-2 text-xs italic text-on-surface-variant dark:text-neutral-500'>
              Demo mode: no actual Nexsyis write happens yet. A mock transaction id will be
              stored so the full flow can be exercised.
            </p>
          </div>
        )}

        {phase !== 'idle' && (
          <ol className='space-y-2'>
            {SYNC_STEPS.map((s, i) => {
              const status: 'pending' | 'running' | 'done' =
                i < stepIdx || phase === 'done'
                  ? 'done'
                  : i === stepIdx
                  ? 'running'
                  : 'pending';
              return (
                <li
                  key={s.key}
                  className={cn(
                    'flex items-center gap-3 rounded-sm border px-3 py-2 text-xs',
                    status === 'done' &&
                      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
                    status === 'running' &&
                      'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300',
                    status === 'pending' &&
                      'border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-500'
                  )}
                >
                  {status === 'done' ? (
                    <IoCheckmarkCircle className='h-4 w-4' />
                  ) : status === 'running' ? (
                    <span className='h-2 w-2 animate-pulse rounded-full bg-blue-500' />
                  ) : (
                    <span className='h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-700' />
                  )}
                  <span>{s.label}</span>
                </li>
              );
            })}
          </ol>
        )}

        {phase === 'done' && syncId && (
          <div className='rounded-sm border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30'>
            <div className='flex items-start gap-2'>
              <IoShieldCheckmarkOutline className='mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400' />
              <div>
                <p className='font-semibold text-on-surface dark:text-white'>
                  Synced to Nexsyis
                </p>
                <p className='mt-1 text-xs text-on-surface-variant dark:text-neutral-400'>
                  Transaction{' '}
                  <span className='font-mono text-on-surface dark:text-white'>{syncId}</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className='flex justify-end gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800'>
        {phase === 'idle' && (
          <>
            <button
              type='button'
              onClick={onClose}
              className='rounded-sm border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-on-surface hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900'
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={startSync}
              className='inline-flex items-center gap-2 rounded-sm bg-on-surface px-4 py-1.5 text-sm font-semibold text-white hover:bg-on-surface/90 dark:bg-white dark:text-black dark:hover:bg-zinc-200'
            >
              <IoCloudUploadOutline className='h-4 w-4' />
              Sync now
            </button>
          </>
        )}
        {phase === 'running' && (
          <span className='text-xs italic text-on-surface-variant dark:text-neutral-500'>
            Syncing…
          </span>
        )}
        {phase === 'done' && (
          <button
            type='button'
            onClick={onSynced}
            className='rounded-sm bg-on-surface px-4 py-1.5 text-sm font-semibold text-white hover:bg-on-surface/90 dark:bg-white dark:text-black dark:hover:bg-zinc-200'
          >
            Done
          </button>
        )}
        {phase === 'error' && (
          <button
            type='button'
            onClick={onClose}
            className='rounded-sm border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-on-surface hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900'
          >
            Close
          </button>
        )}
      </footer>
    </ModalShell>
  );
}

// --------------------------------------------------------------------------
// Check Run modal — mock payment processing preview
// --------------------------------------------------------------------------

interface CheckRunModalProps {
  vendorName: string;
  matches: {
    invoice_number: string;
    statement_amount: number;
    status: string;
  }[];
  onClose: () => void;
}

export function CheckRunModal({ vendorName, matches, onClose }: CheckRunModalProps) {
  const total = matches.reduce((sum, m) => sum + (m.statement_amount ?? 0), 0);
  const startCheckNo = 10_482;

  return (
    <ModalShell onClose={onClose} title='Start check run' subtitle={vendorName}>
      <div className='space-y-4 px-5 py-4 text-sm'>
        <div className='rounded-sm bg-zinc-50 p-3 text-xs text-on-surface-variant dark:bg-zinc-900 dark:text-neutral-400'>
          <IoCardOutline className='mb-1 inline h-4 w-4 align-text-bottom' /> Demo mode — no
          payments will be sent. In production this hands off to Nexsyis&rsquo;{' '}
          <em>Payment Processing</em> module for check printing or ACH.
        </div>

        <div className='overflow-hidden rounded-sm border border-zinc-200 dark:border-zinc-800'>
          <table className='w-full text-xs'>
            <thead className='bg-zinc-50 text-left uppercase tracking-wider text-on-surface-variant dark:bg-zinc-900 dark:text-neutral-400'>
              <tr>
                <th className='px-3 py-2'>Check #</th>
                <th className='px-3 py-2'>Invoice</th>
                <th className='px-3 py-2 text-right'>Amount</th>
                <th className='px-3 py-2'>Status</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m, i) => (
                <tr
                  key={m.invoice_number}
                  className='border-t border-zinc-100 dark:border-zinc-900'
                >
                  <td className='px-3 py-2 font-mono'>#{startCheckNo + i}</td>
                  <td className='px-3 py-2 font-mono'>{m.invoice_number}</td>
                  <td className='px-3 py-2 text-right tabular-nums'>
                    {money(m.statement_amount ?? 0)}
                  </td>
                  <td className='px-3 py-2'>
                    <span className='inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-300'>
                      Queued
                    </span>
                  </td>
                </tr>
              ))}
              <tr className='border-t-2 border-zinc-200 bg-zinc-50 font-semibold dark:border-zinc-700 dark:bg-zinc-900'>
                <td className='px-3 py-2' colSpan={2}>
                  Total
                </td>
                <td className='px-3 py-2 text-right tabular-nums'>{money(total)}</td>
                <td className='px-3 py-2' />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <footer className='flex justify-end gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800'>
        <button
          type='button'
          onClick={onClose}
          className='rounded-sm border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-on-surface hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900'
        >
          Close
        </button>
        <button
          type='button'
          onClick={() => {
            onClose();
          }}
          className='inline-flex items-center gap-2 rounded-sm bg-on-surface px-4 py-1.5 text-sm font-semibold text-white hover:bg-on-surface/90 dark:bg-white dark:text-black dark:hover:bg-zinc-200'
        >
          <IoCardOutline className='h-4 w-4' />
          Hand off to payment module
        </button>
      </footer>
    </ModalShell>
  );
}

// --------------------------------------------------------------------------
// Shared modal chrome
// --------------------------------------------------------------------------

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
      <div className='flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-sm border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950'>
        <header className='flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800'>
          <div>
            <p className='text-xs font-medium uppercase tracking-wider text-on-surface-variant dark:text-neutral-400'>
              {title}
            </p>
            {subtitle && (
              <h2 className='mt-0.5 font-serif text-lg text-on-surface dark:text-white'>
                {subtitle}
              </h2>
            )}
          </div>
          {onClose && (
            <button
              type='button'
              onClick={onClose}
              className='rounded-sm p-1.5 text-on-surface-variant hover:bg-zinc-100 dark:text-neutral-400 dark:hover:bg-zinc-900'
              aria-label='Close'
            >
              <IoCloseOutline className='h-5 w-5' />
            </button>
          )}
        </header>
        <div className='flex-1 overflow-y-auto'>{children}</div>
      </div>
    </div>
  );
}
