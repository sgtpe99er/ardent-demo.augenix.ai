'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  IoAlertCircle,
  IoArrowForwardOutline,
  IoCheckmarkCircle,
  IoHelpCircleOutline,
  IoPlayCircle,
  IoRefresh,
  IoTimeOutline,
} from 'react-icons/io5';

import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/utils/cn';

import { BatchRunPanel } from './batch-run-panel';
import { OcrUpload } from './ocr-upload';

interface Batch {
  id: number;
  vendor_id: number;
  period_start: string;
  period_end: string;
  status: string;
  match_rate: number | null;
  summary: string | null;
  vendor_name: string;
  statement_total: number | null;
}

interface HomeContentProps {
  userEmail: string;
  batches: Batch[];
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatusPill({ status, matchRate }: { status: string; matchRate: number | null }) {
  if (status === 'complete') {
    const ok = (matchRate ?? 0) >= 95;
    return (
      <span
        className={
          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ' +
          (ok
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
            : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300')
        }
      >
        {ok ? <IoCheckmarkCircle /> : <IoAlertCircle />}
        {(matchRate ?? 0).toFixed(1)}% match
      </span>
    );
  }
  if (status === 'running') {
    return (
      <span className='inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-300'>
        <IoTimeOutline /> Running
      </span>
    );
  }
  if (status === 'needs_review') {
    return (
      <span className='inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-300'>
        <IoAlertCircle /> Needs review
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className='inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-800 dark:bg-rose-950 dark:text-rose-300'>
        <IoAlertCircle /> Error
      </span>
    );
  }
  return (
    <span className='inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'>
      <IoTimeOutline /> Pending
    </span>
  );
}

export function HomeContent({ userEmail, batches }: HomeContentProps) {
  const pending = batches.filter(
    (b) => b.status === 'pending' || b.status === 'running' || b.status === 'needs_review'
  );
  const done = batches.filter((b) => b.status === 'complete' || b.status === 'error');

  const router = useRouter();
  const { toast } = useToast();
  const [resetting, setResetting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [runPanelOpen, setRunPanelOpen] = useState(false);

  const runnablePending = pending.filter((b) => b.status !== 'running');
  const selectedBatches = runnablePending.filter((b) => selected.has(b.id));
  const allSelected = runnablePending.length > 0 && selected.size === runnablePending.length;

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(runnablePending.map((b) => b.id)));
    }
  }

  async function handleReset() {
    if (!window.confirm('Reset all reconciliation batches back to pending? This clears all AI runs and audit logs from the demo.')) return;
    setResetting(true);
    try {
      const res = await fetch('/api/reconcile/reset', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      toast({ description: 'Demo data reset. All batches are pending again.' });
      router.refresh();
    } catch (err) {
      toast({ variant: 'destructive', description: `Reset failed: ${(err as Error).message}` });
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className='py-2 lg:py-3'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <h1 className='font-serif text-3xl font-normal leading-[1.05] tracking-tight text-on-surface dark:text-white lg:text-5xl'>
          Vendor Statement Reconciliation
        </h1>
        <div className='flex flex-wrap items-center gap-2'>
          <button
            type='button'
            onClick={handleReset}
            disabled={resetting}
            className='inline-flex items-center gap-1.5 rounded-sm border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900'
          >
            <IoRefresh className={resetting ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            {resetting ? 'Resetting…' : 'Reset demo data'}
          </button>
          <Link
            href='/dashboard/help'
            className='inline-flex items-center gap-1.5 rounded-sm border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900'
          >
            <IoHelpCircleOutline className='h-4 w-4' />
            How it works
          </Link>
          <Link
            href='/dashboard/roadmap'
            className='inline-flex items-center gap-1.5 rounded-sm bg-on-surface px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-on-surface/90 dark:bg-white dark:text-black dark:hover:bg-zinc-200'
          >
            See What&rsquo;s Coming
            <IoArrowForwardOutline className='h-4 w-4' />
          </Link>
        </div>
      </div>
      <p className='mt-4 max-w-2xl text-sm leading-relaxed text-on-surface-variant dark:text-neutral-400'>
        Select a vendor statement below to run the three-agent consensus reconciliation against
        your Nexsyis invoices.
      </p>

      <OcrUpload />

      <Section
        title='Pending statements'
        subtitle='Awaiting reconciliation'
        action={
          runnablePending.length > 0 && (
            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={toggleAll}
                className='text-xs font-medium uppercase tracking-wider text-on-surface-variant hover:text-on-surface dark:text-neutral-400 dark:hover:text-white'
              >
                {allSelected ? 'Clear selection' : 'Select all'}
              </button>
              <button
                type='button'
                onClick={() => setRunPanelOpen(true)}
                disabled={selected.size === 0}
                className='inline-flex items-center gap-1.5 rounded-sm bg-on-surface px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-on-surface/90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200'
              >
                <IoPlayCircle className='h-4 w-4' />
                Run Batch Reconciliation{selected.size > 0 ? ` (${selected.size})` : ''}
              </button>
            </div>
          )
        }
      >
        {pending.length === 0 ? (
          <Empty>No pending statements. Start a new period when your vendor sends theirs.</Empty>
        ) : (
          <BatchGrid
            batches={pending}
            selected={selected}
            onToggle={toggle}
          />
        )}
      </Section>

      <Section title='Recent reconciliations' subtitle='Completed in this demo'>
        {done.length === 0 ? (
          <Empty>No completed reconciliations yet. Pick a pending statement to begin.</Empty>
        ) : (
          <BatchGrid batches={done} />
        )}
      </Section>

      {runPanelOpen && (
        <BatchRunPanel
          batches={selectedBatches.map((b) => ({ id: b.id, vendor_name: b.vendor_name }))}
          onClose={() => {
            setRunPanelOpen(false);
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className='mt-12'>
      <div className='mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-zinc-200 pb-2 dark:border-zinc-800'>
        <h2 className='font-serif text-xl text-on-surface dark:text-white'>{title}</h2>
        <div className='flex items-baseline gap-4'>
          <span className='font-serif text-xs italic text-on-surface-variant dark:text-neutral-500'>
            {subtitle}
          </span>
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className='rounded-sm border border-dashed border-zinc-300 px-4 py-6 text-sm text-on-surface-variant dark:border-zinc-800 dark:text-neutral-500'>
      {children}
    </p>
  );
}

function BatchGrid({
  batches,
  selected,
  onToggle,
}: {
  batches: Batch[];
  selected?: Set<number>;
  onToggle?: (id: number) => void;
}) {
  const selectable = Boolean(selected && onToggle);
  return (
    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
      {batches.map((b) => {
        const isSelected = selected?.has(b.id) ?? false;
        const disabled = b.status === 'running';
        return (
          <div
            key={b.id}
            className={cn(
              'group relative flex flex-col rounded-sm border bg-white p-5 transition-colors dark:bg-zinc-950',
              isSelected
                ? 'border-on-surface ring-2 ring-on-surface/20 dark:border-white dark:ring-white/20'
                : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600'
            )}
          >
            {selectable && !disabled && (
              <label
                className='absolute left-3 top-3 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm border border-zinc-300 bg-white shadow-sm hover:border-on-surface dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-white'
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type='checkbox'
                  checked={isSelected}
                  onChange={() => onToggle?.(b.id)}
                  className='h-4 w-4 accent-on-surface dark:accent-white'
                />
              </label>
            )}
            <Link
              href={`/dashboard/reconcile/${b.id}`}
              className='flex flex-col'
              prefetch={false}
            >
          <div className={cn('flex items-center justify-between', selectable && 'pl-9')}>
            <span className='font-serif text-lg text-on-surface dark:text-white'>
              {b.vendor_name}
            </span>
            <StatusPill status={b.status} matchRate={b.match_rate} />
          </div>
          <div className='mt-2 text-xs uppercase tracking-wider text-on-surface-variant dark:text-neutral-400'>
            {b.period_start} → {b.period_end}
          </div>
          <div className='mt-4 flex items-end justify-between'>
            <div>
              <div className='text-[10px] uppercase tracking-wider text-on-surface-variant dark:text-neutral-500'>
                Statement total
              </div>
              <div className='font-serif text-2xl text-on-surface dark:text-white'>
                {b.statement_total != null
                  ? b.statement_total.toLocaleString(undefined, {
                      style: 'currency',
                      currency: 'USD',
                    })
                  : '—'}
              </div>
            </div>
            <span className='text-xs font-medium text-on-surface-variant group-hover:text-on-surface dark:text-neutral-400 dark:group-hover:text-white'>
              Open →
            </span>
          </div>
          {b.summary && (
            <p className='mt-4 line-clamp-2 text-xs italic text-on-surface-variant dark:text-neutral-500'>
              {b.summary}
            </p>
          )}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
