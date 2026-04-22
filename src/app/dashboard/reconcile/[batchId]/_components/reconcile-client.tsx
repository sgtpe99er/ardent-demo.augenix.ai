'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  IoAlertCircle,
  IoArrowBack,
  IoCheckmarkCircle,
  IoDownloadOutline,
  IoPlayCircle,
  IoRefresh,
  IoSparklesOutline,
} from 'react-icons/io5';

import {
  applyProgressEvent,
  consumeNdjson,
  makeInitialSteps,
  ReconcileProgress,
  type StepState,
} from '@/components/reconcile-progress';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/utils/cn';

export interface ReconcileInvoice {
  invoice_number: string;
  lk_code: string;
  amount: number;
  invoice_date: string;
  status: string;
}

export interface ReconcileMatch {
  invoice_number: string;
  lk_code: string;
  system_amount: number;
  statement_amount: number;
  difference: number;
  status: 'matched' | 'flagged' | string;
  confidence: number;
  reasoning: string;
  oddity_flag: string | null;
}

export interface ReconcileBatch {
  id: number;
  vendor_name: string;
  period_start: string;
  period_end: string;
  status: string;
  summary: string | null;
  match_rate: number | null;
  warnings: string[];
}

export interface ReconcileStatement {
  total_amount: number;
  period_start: string;
  period_end: string;
  statement_text: string;
}

export interface AuditLog {
  id: number;
  run_label: string;
  model: string | null;
  duration_ms: number | null;
  created_at: string;
  raw_output: unknown;
}

interface Props {
  batch: ReconcileBatch;
  statement: ReconcileStatement | null;
  invoices: ReconcileInvoice[];
  matches: ReconcileMatch[];
  auditLogs: AuditLog[];
}

const money = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

export function ReconcileClient({ batch, statement, invoices, matches, auditLogs }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [lineRunning, setLineRunning] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [steps, setSteps] = useState<StepState[]>(() => makeInitialSteps());
  const [unfinalizing, setUnfinalizing] = useState(false);

  const systemTotal = invoices.reduce((sum, i) => sum + i.amount, 0);
  const hasResults = matches.length > 0;
  const isFinalized = batch.status === 'complete';

  async function runReconcile(invoice_number?: string) {
    if (invoice_number) setLineRunning(invoice_number);
    else {
      setRunning(true);
      setSteps(makeInitialSteps());
    }
    try {
      const res = await fetch('/api/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batch.id, invoice_number }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      let finalError: string | null = null;
      await consumeNdjson(res, (event) => {
        if (!invoice_number) {
          setSteps((prev) => applyProgressEvent(prev, event as { type: string; step?: string }));
        }
        if (event.type === 'error') {
          finalError = (event.error as string) ?? 'Reconciliation failed';
        }
      });

      if (finalError) throw new Error(finalError);
      toast({ description: invoice_number ? 'Line re-reconciled.' : 'Reconciliation complete.' });
      router.refresh();
    } catch (err) {
      toast({
        variant: 'destructive',
        description: `Reconciliation failed: ${(err as Error).message}`,
      });
    } finally {
      setRunning(false);
      setLineRunning(null);
    }
  }

  async function unfinalize() {
    if (!window.confirm('Un-finalize this batch? It will return to "needs review" and become editable again.')) return;
    setUnfinalizing(true);
    try {
      const res = await fetch(`/api/reconcile/${batch.id}/unfinalize`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      toast({ description: 'Batch un-finalized. You can now re-run or edit.' });
      router.refresh();
    } catch (err) {
      toast({ variant: 'destructive', description: `Failed: ${(err as Error).message}` });
    } finally {
      setUnfinalizing(false);
    }
  }

  return (
    <div className='py-8 lg:py-12'>
      <Link
        href='/dashboard'
        className='inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-on-surface-variant hover:text-on-surface dark:text-neutral-400 dark:hover:text-white'
      >
        <IoArrowBack className='h-3.5 w-3.5' /> All statements
      </Link>

      <div className='mt-4 flex flex-wrap items-end justify-between gap-6 border-b border-zinc-200 pb-6 dark:border-zinc-800'>
        <div>
          <p className='font-sans text-xs uppercase tracking-[0.2em] text-on-surface-variant dark:text-neutral-400'>
            Reconciliation
          </p>
          <h1 className='mt-1 font-serif text-3xl font-normal tracking-tight text-on-surface dark:text-white lg:text-4xl'>
            {batch.vendor_name}
          </h1>
          <p className='mt-2 text-sm text-on-surface-variant dark:text-neutral-400'>
            Period {batch.period_start} → {batch.period_end}
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          {isFinalized && (
            <button
              type='button'
              onClick={unfinalize}
              disabled={unfinalizing || running}
              className='inline-flex items-center gap-2 rounded-sm border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60'
            >
              <IoAlertCircle className='h-4 w-4' />
              {unfinalizing ? 'Un-finalizing…' : 'Un-finalize batch'}
            </button>
          )}
          {hasResults && (
            <a
              href={`/api/reconcile/${batch.id}/export`}
              className='inline-flex items-center gap-2 rounded-sm border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900'
            >
              <IoDownloadOutline className='h-4 w-4' /> Export CSV
            </a>
          )}
          <button
            type='button'
            onClick={() => runReconcile()}
            disabled={running || !statement}
            className='inline-flex items-center gap-2 rounded-sm bg-on-surface px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-surface/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200'
          >
            {running ? (
              <>
                <IoSparklesOutline className='h-4 w-4 animate-pulse' /> Running…
              </>
            ) : hasResults ? (
              <>
                <IoRefresh className='h-4 w-4' /> Re-Run All
              </>
            ) : (
              <>
                <IoPlayCircle className='h-4 w-4' /> Run reconciliation
              </>
            )}
          </button>
        </div>
      </div>

      {running && (
        <div className='mt-6'>
          <ReconcileProgress
            steps={steps}
            heading={`${batch.vendor_name} · ${batch.period_start} → ${batch.period_end}`}
          />
        </div>
      )}

      {/* Summary cards */}
      <div className='mt-8 grid gap-4 md:grid-cols-3'>
        <Card label='System invoice total' value={money(systemTotal)} sub={`${invoices.length} invoices`} />
        <Card
          label='Statement total'
          value={statement ? money(statement.total_amount) : '—'}
          sub={statement ? `${statement.period_start} → ${statement.period_end}` : 'No statement found'}
        />
        <Card
          label='Match rate'
          value={batch.match_rate != null ? `${batch.match_rate.toFixed(1)}%` : '—'}
          sub={batch.summary ?? (hasResults ? 'Consensus computed' : 'Not yet reconciled')}
          tone={
            batch.match_rate != null && batch.match_rate >= 95
              ? 'good'
              : batch.match_rate != null
              ? 'warn'
              : undefined
          }
        />
      </div>

      {batch.warnings.length > 0 && (
        <div className='mt-6 rounded-sm border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40'>
          <div className='mb-1 flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200'>
            <IoAlertCircle /> Batch-level warnings
          </div>
          <ul className='list-disc pl-5 text-sm text-amber-900 dark:text-amber-200'>
            {batch.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Statement raw text */}
      {statement && (
        <section className='mt-10'>
          <h2 className='mb-2 font-serif text-lg text-on-surface dark:text-white'>Vendor statement</h2>
          <pre className='whitespace-pre-wrap rounded-sm border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-relaxed text-on-surface-variant dark:border-zinc-800 dark:bg-zinc-950 dark:text-neutral-400'>
            {statement.statement_text}
          </pre>
        </section>
      )}

      {/* Invoices */}
      <section className='mt-10'>
        <h2 className='mb-2 font-serif text-lg text-on-surface dark:text-white'>
          System invoices ({invoices.length})
        </h2>
        <div className='overflow-hidden rounded-sm border border-zinc-200 dark:border-zinc-800'>
          <table className='w-full text-sm'>
            <thead className='bg-zinc-50 text-left text-xs uppercase tracking-wider text-on-surface-variant dark:bg-zinc-950 dark:text-neutral-400'>
              <tr>
                <Th>Invoice #</Th>
                <Th>LK</Th>
                <Th>Date</Th>
                <Th className='text-right'>Amount</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.invoice_number + i.invoice_date} className='border-t border-zinc-100 dark:border-zinc-900'>
                  <Td mono>{i.invoice_number}</Td>
                  <Td mono>{i.lk_code}</Td>
                  <Td>{i.invoice_date}</Td>
                  <Td className='text-right tabular-nums'>{money(i.amount)}</Td>
                  <Td>{i.status}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Results */}
      <section className='mt-12'>
        <div className='mb-3 flex items-center justify-between'>
          <h2 className='font-serif text-lg text-on-surface dark:text-white'>Reconciliation results</h2>
          {auditLogs.length > 0 && (
            <button
              type='button'
              onClick={() => setShowAudit((s) => !s)}
              className='text-xs font-medium uppercase tracking-wider text-on-surface-variant hover:text-on-surface dark:text-neutral-400 dark:hover:text-white'
            >
              {showAudit ? 'Hide' : 'Show'} edit history ({auditLogs.length})
            </button>
          )}
        </div>

        {!hasResults ? (
          <div className='rounded-sm border border-dashed border-zinc-300 px-4 py-10 text-center dark:border-zinc-800'>
            <IoSparklesOutline className='mx-auto mb-3 h-6 w-6 text-on-surface-variant dark:text-neutral-400' />
            <p className='text-sm text-on-surface-variant dark:text-neutral-400'>
              Not yet reconciled. Click <span className='font-medium'>Run reconciliation</span> to launch
              the 3-agent consensus analysis.
            </p>
          </div>
        ) : (
          <div className='overflow-hidden rounded-sm border border-zinc-200 dark:border-zinc-800'>
            <table className='w-full text-sm'>
              <thead className='bg-zinc-50 text-left text-xs uppercase tracking-wider text-on-surface-variant dark:bg-zinc-950 dark:text-neutral-400'>
                <tr>
                  <Th>Invoice</Th>
                  <Th>LK</Th>
                  <Th className='text-right'>System</Th>
                  <Th className='text-right'>Statement</Th>
                  <Th className='text-right'>Δ</Th>
                  <Th>Confidence</Th>
                  <Th>Reasoning</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr
                    key={m.invoice_number}
                    className={cn(
                      'border-t border-zinc-100 align-top dark:border-zinc-900',
                      m.status === 'flagged' && 'bg-amber-50/60 dark:bg-amber-950/20'
                    )}
                  >
                    <Td mono>
                      <div className='flex items-center gap-1.5'>
                        {m.status === 'matched' ? (
                          <IoCheckmarkCircle className='h-4 w-4 text-emerald-600 dark:text-emerald-400' />
                        ) : (
                          <IoAlertCircle className='h-4 w-4 text-amber-600 dark:text-amber-400' />
                        )}
                        {m.invoice_number}
                      </div>
                    </Td>
                    <Td mono>{m.lk_code}</Td>
                    <Td className='text-right tabular-nums'>{money(m.system_amount)}</Td>
                    <Td className='text-right tabular-nums'>{money(m.statement_amount)}</Td>
                    <Td
                      className={cn(
                        'text-right tabular-nums',
                        Math.abs(m.difference) > 0.005 && 'font-semibold text-amber-700 dark:text-amber-300'
                      )}
                    >
                      {money(m.difference)}
                    </Td>
                    <Td>
                      <ConfidenceBar value={m.confidence} />
                    </Td>
                    <Td className='max-w-sm text-on-surface-variant dark:text-neutral-400'>
                      {m.oddity_flag && (
                        <div className='mb-1 text-xs font-semibold text-amber-700 dark:text-amber-300'>
                          {m.oddity_flag}
                        </div>
                      )}
                      <div className='text-xs leading-relaxed'>{m.reasoning}</div>
                    </Td>
                    <Td>
                      <button
                        type='button'
                        onClick={() => runReconcile(m.invoice_number)}
                        disabled={lineRunning === m.invoice_number || running}
                        className='inline-flex items-center gap-1 rounded-sm border border-zinc-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-neutral-400 dark:hover:bg-zinc-900'
                      >
                        <IoRefresh className={cn('h-3 w-3', lineRunning === m.invoice_number && 'animate-spin')} />
                        {lineRunning === m.invoice_number ? 'Re-running' : 'Re-run AI'}
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit history */}
      {showAudit && auditLogs.length > 0 && (
        <section className='mt-8'>
          <h2 className='mb-1 font-serif text-lg text-on-surface dark:text-white'>Edit history</h2>
          <p className='mb-4 text-xs text-on-surface-variant dark:text-neutral-500'>
            Every reconciliation attempt is preserved — each shows the 3 parallel AI runs plus
            the final consensus audit.
          </p>
          <ol className='space-y-6'>
            {groupAuditLogs(auditLogs).map((attempt, idx, arr) => (
              <li key={attempt.attemptKey} className='relative pl-6'>
                <span className='absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-on-surface text-[10px] font-semibold text-white dark:bg-white dark:text-black'>
                  {arr.length - idx}
                </span>
                <div className='flex items-baseline justify-between gap-4 border-b border-zinc-200 pb-2 dark:border-zinc-800'>
                  <span className='font-serif text-sm font-medium text-on-surface dark:text-white'>
                    Attempt {arr.length - idx}
                  </span>
                  <span className='font-mono text-[11px] text-on-surface-variant dark:text-neutral-500'>
                    {new Date(attempt.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className='mt-3 space-y-2'>
                  {attempt.logs.map((log) => (
                    <details
                      key={log.id}
                      className='rounded-sm border border-zinc-200 bg-white text-xs dark:border-zinc-800 dark:bg-zinc-950'
                    >
                      <summary className='flex cursor-pointer items-center justify-between px-3 py-2'>
                        <span className='flex items-center gap-2'>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                              log.run_label === 'consensus'
                                ? 'bg-on-surface text-white dark:bg-white dark:text-black'
                                : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                            )}
                          >
                            {log.run_label}
                          </span>
                          <span className='font-mono text-[11px] text-on-surface-variant dark:text-neutral-400'>
                            {log.model}
                          </span>
                        </span>
                        <span className='font-mono text-[11px] text-on-surface-variant dark:text-neutral-500'>
                          {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '—'}
                        </span>
                      </summary>
                      <pre className='max-h-80 overflow-auto whitespace-pre-wrap border-t border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] leading-relaxed text-on-surface-variant dark:border-zinc-800 dark:bg-zinc-950 dark:text-neutral-400'>
                        {JSON.stringify(log.raw_output, null, 2)}
                      </pre>
                    </details>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/**
 * Group audit rows into "attempts" — rows within 60 seconds of each other
 * are treated as one reconciliation attempt (3 parallel runs + consensus).
 * Most recent attempt is returned first.
 */
function groupAuditLogs(logs: AuditLog[]): {
  attemptKey: string;
  timestamp: string;
  logs: AuditLog[];
}[] {
  const sorted = [...logs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const attempts: { attemptKey: string; timestamp: string; logs: AuditLog[] }[] = [];
  const WINDOW_MS = 60_000;
  for (const log of sorted) {
    const t = new Date(log.created_at).getTime();
    const last = attempts[attempts.length - 1];
    if (last && Math.abs(new Date(last.timestamp).getTime() - t) < WINDOW_MS) {
      last.logs.push(log);
    } else {
      attempts.push({ attemptKey: log.created_at, timestamp: log.created_at, logs: [log] });
    }
  }
  // Sort each attempt's logs in canonical order (run_1, run_2, run_3, consensus)
  const order = ['run_1', 'run_2', 'run_3', 'consensus'];
  for (const a of attempts) {
    a.logs.sort((x, y) => order.indexOf(x.run_label) - order.indexOf(y.run_label));
  }
  return attempts;
}

function Card({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'warn';
}) {
  return (
    <div
      className={cn(
        'rounded-sm border p-5',
        tone === 'good'
          ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30'
          : tone === 'warn'
          ? 'border-amber-300 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30'
          : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
      )}
    >
      <div className='text-[10px] uppercase tracking-wider text-on-surface-variant dark:text-neutral-400'>
        {label}
      </div>
      <div className='mt-1 font-serif text-2xl text-on-surface dark:text-white'>{value}</div>
      {sub && <div className='mt-1 text-xs text-on-surface-variant dark:text-neutral-500'>{sub}</div>}
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const tone = clamped >= 85 ? 'bg-emerald-500' : clamped >= 70 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className='flex items-center gap-2'>
      <div className='h-1.5 w-16 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800'>
        <div className={cn('h-full', tone)} style={{ width: `${clamped}%` }} />
      </div>
      <span className='text-xs tabular-nums text-on-surface-variant dark:text-neutral-400'>
        {clamped.toFixed(0)}%
      </span>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn('px-3 py-2 font-medium', className)}>{children}</th>;
}

function Td({
  children,
  className,
  mono,
}: {
  children: React.ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <td className={cn('px-3 py-2.5', mono && 'font-mono', className)}>
      {children}
    </td>
  );
}
