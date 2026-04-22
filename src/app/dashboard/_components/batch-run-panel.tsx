'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IoCheckmarkCircle, IoCloseOutline, IoPlayCircle, IoSparklesOutline } from 'react-icons/io5';

import {
  applyProgressEvent,
  consumeNdjson,
  makeInitialSteps,
  ReconcileProgress,
  type StepState,
} from '@/components/reconcile-progress';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/utils/cn';

export interface SelectedBatch {
  id: number;
  vendor_name: string;
}

interface BatchRunPanelProps {
  batches: SelectedBatch[];
  onClose: () => void;
}

interface BatchProgress {
  batchId: number;
  vendorName: string;
  steps: StepState[];
  status: 'pending' | 'running' | 'complete' | 'error';
  error?: string;
}

/**
 * Overlay panel that runs reconciliation for multiple batches sequentially,
 * streaming per-step progress from each server response.
 */
export function BatchRunPanel({ batches, onClose }: BatchRunPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [progress, setProgress] = useState<BatchProgress[]>(() =>
    batches.map((b) => ({
      batchId: b.id,
      vendorName: b.vendor_name,
      steps: makeInitialSteps(),
      status: 'pending',
    }))
  );
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const currentIdx = progress.findIndex((p) => p.status === 'running');

  async function runAll() {
    setRunning(true);
    setDone(false);
    for (let i = 0; i < batches.length; i++) {
      const b = batches[i];
      setProgress((prev) =>
        prev.map((p, idx) => (idx === i ? { ...p, status: 'running' } : p))
      );
      try {
        const res = await fetch('/api/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch_id: b.id }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        let batchError: string | null = null;
        await consumeNdjson(res, (event) => {
          setProgress((prev) =>
            prev.map((p, idx) =>
              idx === i
                ? { ...p, steps: applyProgressEvent(p.steps, event as { type: string; step?: string }) }
                : p
            )
          );
          if (event.type === 'error') batchError = (event.error as string) ?? 'Unknown error';
        });
        if (batchError) throw new Error(batchError);
        setProgress((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, status: 'complete' } : p))
        );
      } catch (err) {
        const msg = (err as Error).message;
        setProgress((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, status: 'error', error: msg } : p))
        );
        toast({
          variant: 'destructive',
          description: `${b.vendor_name}: ${msg}`,
        });
      }
    }
    setRunning(false);
    setDone(true);
    toast({ description: 'Batch reconciliation finished.' });
    router.refresh();
  }

  const completeCount = progress.filter((p) => p.status === 'complete').length;
  const errorCount = progress.filter((p) => p.status === 'error').length;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
      <div className='relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-sm border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950'>
        <header className='flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800'>
          <div>
            <p className='text-xs font-medium uppercase tracking-wider text-on-surface-variant dark:text-neutral-400'>
              Batch reconciliation
            </p>
            <h2 className='mt-0.5 font-serif text-xl text-on-surface dark:text-white'>
              {batches.length} vendors · April 2026
            </h2>
          </div>
          <button
            type='button'
            onClick={onClose}
            disabled={running}
            className='rounded-sm p-1.5 text-on-surface-variant hover:bg-zinc-100 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-zinc-900'
            aria-label='Close'
          >
            <IoCloseOutline className='h-5 w-5' />
          </button>
        </header>

        <div className='flex-1 overflow-y-auto px-6 py-5'>
          {!running && !done && (
            <div className='mb-5 rounded-sm bg-zinc-50 p-4 text-sm text-on-surface-variant dark:bg-zinc-900 dark:text-neutral-300'>
              Ready to run 3-agent consensus reconciliation for{' '}
              <strong className='text-on-surface dark:text-white'>{batches.length} vendors</strong>.
              Each vendor will go through 3 parallel LLM runs plus a consensus audit, sequentially.
              Expected total runtime: ~{Math.round(batches.length * 15)}s.
            </div>
          )}

          {(running || done) && (
            <div className='mb-5 rounded-sm border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900'>
              <div className='flex items-center justify-between text-sm'>
                <span className='font-semibold text-on-surface dark:text-white'>
                  {done
                    ? `Finished: ${completeCount} complete, ${errorCount} failed`
                    : `Vendor ${Math.max(currentIdx, 0) + 1} of ${batches.length}: ${
                        progress[Math.max(currentIdx, 0)]?.vendorName ?? ''
                      }`}
                </span>
                <span className='text-xs tabular-nums text-on-surface-variant dark:text-neutral-400'>
                  {completeCount + errorCount} / {batches.length}
                </span>
              </div>
              <div className='mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800'>
                <div
                  className='h-full bg-on-surface transition-all duration-300 dark:bg-white'
                  style={{ width: `${((completeCount + errorCount) / batches.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          <ol className='space-y-3'>
            {progress.map((p, idx) => (
              <li key={p.batchId}>
                <div
                  className={cn(
                    'flex items-center justify-between rounded-sm border px-4 py-3 text-sm',
                    p.status === 'complete' &&
                      'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30',
                    p.status === 'running' &&
                      'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30',
                    p.status === 'error' &&
                      'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
                    p.status === 'pending' &&
                      'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
                  )}
                >
                  <div className='flex items-center gap-3'>
                    <span
                      className={cn(
                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                        p.status === 'complete' && 'bg-emerald-600 text-white',
                        p.status === 'running' && 'bg-blue-600 text-white',
                        p.status === 'error' && 'bg-red-600 text-white',
                        p.status === 'pending' &&
                          'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                      )}
                    >
                      {p.status === 'complete' ? <IoCheckmarkCircle /> : idx + 1}
                    </span>
                    <span className='font-medium text-on-surface dark:text-white'>
                      {p.vendorName}
                    </span>
                  </div>
                  {p.status === 'error' && (
                    <span className='text-xs text-red-700 dark:text-red-300'>{p.error}</span>
                  )}
                </div>
                {p.status === 'running' && (
                  <div className='mt-2'>
                    <ReconcileProgress steps={p.steps} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>

        <footer className='flex justify-end gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800'>
          {done ? (
            <button
              type='button'
              onClick={onClose}
              className='rounded-sm bg-on-surface px-4 py-2 text-sm font-semibold text-white hover:bg-on-surface/90 dark:bg-white dark:text-black dark:hover:bg-zinc-200'
            >
              Close
            </button>
          ) : (
            <>
              <button
                type='button'
                onClick={onClose}
                disabled={running}
                className='rounded-sm border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-on-surface hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={runAll}
                disabled={running}
                className='inline-flex items-center gap-2 rounded-sm bg-on-surface px-4 py-2 text-sm font-semibold text-white hover:bg-on-surface/90 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200'
              >
                {running ? (
                  <>
                    <IoSparklesOutline className='h-4 w-4 animate-pulse' /> Running…
                  </>
                ) : (
                  <>
                    <IoPlayCircle className='h-4 w-4' /> Run Batch Reconciliation
                  </>
                )}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
