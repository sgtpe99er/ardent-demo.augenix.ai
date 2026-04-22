'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  IoAlertCircle,
  IoArrowBack,
  IoCheckmarkCircle,
  IoCloseOutline,
  IoCreateOutline,
  IoDownloadOutline,
  IoPersonCircleOutline,
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

export interface HumanOverride {
  id: number;
  invoice_number: string | null;
  user_email: string | null;
  previous_status: string | null;
  new_status: string | null;
  previous_reasoning: string | null;
  new_reasoning: string | null;
  note: string | null;
  created_at: string;
}

interface Props {
  batch: ReconcileBatch;
  statement: ReconcileStatement | null;
  invoices: ReconcileInvoice[];
  matches: ReconcileMatch[];
  auditLogs: AuditLog[];
  overrides: HumanOverride[];
}

const money = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

export function ReconcileClient({
  batch,
  statement,
  invoices,
  matches,
  auditLogs,
  overrides,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [lineRunning, setLineRunning] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [steps, setSteps] = useState<StepState[]>(() => makeInitialSteps());
  const [unfinalizing, setUnfinalizing] = useState(false);
  const [editingRow, setEditingRow] = useState<ReconcileMatch | null>(null);

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
          {(auditLogs.length > 0 || overrides.length > 0) && (
            <button
              type='button'
              onClick={() => setShowAudit((s) => !s)}
              className='text-xs font-medium uppercase tracking-wider text-on-surface-variant hover:text-on-surface dark:text-neutral-400 dark:hover:text-white'
            >
              {showAudit ? 'Hide' : 'Show'} edit history ({auditLogs.length + overrides.length})
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
                      <div className='flex flex-col items-stretch gap-1'>
                        <button
                          type='button'
                          onClick={() => runReconcile(m.invoice_number)}
                          disabled={lineRunning === m.invoice_number || running || isFinalized}
                          title={isFinalized ? 'Un-finalize the batch first' : undefined}
                          className='inline-flex items-center justify-center gap-1 rounded-sm border border-zinc-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-neutral-400 dark:hover:bg-zinc-900'
                        >
                          <IoRefresh className={cn('h-3 w-3', lineRunning === m.invoice_number && 'animate-spin')} />
                          {lineRunning === m.invoice_number ? 'Re-running' : 'Re-run AI'}
                        </button>
                        <button
                          type='button'
                          onClick={() => setEditingRow(m)}
                          disabled={running || isFinalized}
                          title={isFinalized ? 'Un-finalize the batch first' : undefined}
                          className='inline-flex items-center justify-center gap-1 rounded-sm border border-zinc-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-neutral-400 dark:hover:bg-zinc-900'
                        >
                          <IoCreateOutline className='h-3 w-3' />
                          Override
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit history */}
      {showAudit && (auditLogs.length > 0 || overrides.length > 0) && (
        <section className='mt-8'>
          <h2 className='mb-1 font-serif text-lg text-on-surface dark:text-white'>Edit history</h2>
          <p className='mb-4 text-xs text-on-surface-variant dark:text-neutral-500'>
            Every reconciliation attempt and every human override is preserved for full audit
            traceability.
          </p>
          <ol className='space-y-6'>
            {buildHistoryTimeline(auditLogs, overrides).map((entry, idx, arr) => {
              const numLabel = arr.length - idx;
              if (entry.kind === 'attempt') {
                return (
                  <li key={entry.key} className='relative pl-6'>
                    <span className='absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-on-surface text-[10px] font-semibold text-white dark:bg-white dark:text-black'>
                      {numLabel}
                    </span>
                    <div className='flex items-baseline justify-between gap-4 border-b border-zinc-200 pb-2 dark:border-zinc-800'>
                      <span className='font-serif text-sm font-medium text-on-surface dark:text-white'>
                        AI reconciliation attempt
                      </span>
                      <span className='font-mono text-[11px] text-on-surface-variant dark:text-neutral-500'>
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className='mt-3 space-y-2'>
                      {entry.logs.map((log) => (
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
                );
              }
              // Human override entry
              const o = entry.override;
              const statusChanged = o.previous_status !== o.new_status;
              const reasoningChanged = (o.previous_reasoning ?? '') !== (o.new_reasoning ?? '');
              return (
                <li key={entry.key} className='relative pl-6'>
                  <span className='absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white'>
                    <IoPersonCircleOutline className='h-3.5 w-3.5' />
                  </span>
                  <div className='flex items-baseline justify-between gap-4 border-b border-amber-200 pb-2 dark:border-amber-900'>
                    <span className='font-serif text-sm font-medium text-on-surface dark:text-white'>
                      Human override
                      <span className='ml-2 font-sans text-xs font-normal text-on-surface-variant dark:text-neutral-400'>
                        {o.user_email ?? 'Office Manager'} · invoice{' '}
                        <span className='font-mono'>{o.invoice_number}</span>
                      </span>
                    </span>
                    <span className='font-mono text-[11px] text-on-surface-variant dark:text-neutral-500'>
                      {new Date(o.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className='mt-3 space-y-2 rounded-sm border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/30'>
                    {statusChanged && (
                      <div>
                        <span className='font-medium text-on-surface dark:text-white'>Status:</span>{' '}
                        <span className='font-mono text-on-surface-variant line-through dark:text-neutral-400'>
                          {o.previous_status ?? '—'}
                        </span>{' '}
                        →{' '}
                        <span className='font-mono font-semibold text-on-surface dark:text-white'>
                          {o.new_status ?? '—'}
                        </span>
                      </div>
                    )}
                    {reasoningChanged && (
                      <div>
                        <span className='font-medium text-on-surface dark:text-white'>
                          Reasoning:
                        </span>
                        <div className='mt-1 whitespace-pre-wrap text-on-surface-variant line-through dark:text-neutral-400'>
                          {o.previous_reasoning ?? '—'}
                        </div>
                        <div className='mt-1 whitespace-pre-wrap font-medium text-on-surface dark:text-white'>
                          {o.new_reasoning ?? '—'}
                        </div>
                      </div>
                    )}
                    {o.note && (
                      <div>
                        <span className='font-medium text-on-surface dark:text-white'>Note:</span>{' '}
                        <span className='italic text-on-surface-variant dark:text-neutral-300'>
                          {o.note}
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {editingRow && (
        <OverrideModal
          batchId={batch.id}
          row={editingRow}
          onClose={() => setEditingRow(null)}
          onSaved={() => {
            setEditingRow(null);
            router.refresh();
            toast({ description: 'Override saved to audit trail.' });
          }}
        />
      )}
    </div>
  );
}

type TimelineEntry =
  | { kind: 'attempt'; key: string; timestamp: string; logs: AuditLog[] }
  | { kind: 'override'; key: string; timestamp: string; override: HumanOverride };

/**
 * Build a merged, reverse-chronological timeline of AI reconciliation
 * attempts and human overrides. AI rows written within 60 seconds of each
 * other are grouped into a single attempt (3 parallel runs + consensus).
 */
function buildHistoryTimeline(
  logs: AuditLog[],
  overrides: HumanOverride[]
): TimelineEntry[] {
  const WINDOW_MS = 60_000;
  const ATTEMPT_ORDER = ['run_1', 'run_2', 'run_3', 'consensus'];

  // 1) Group audit logs into attempts (oldest-first while grouping).
  const ascending = [...logs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const attempts: TimelineEntry[] = [];
  for (const log of ascending) {
    const t = new Date(log.created_at).getTime();
    const last = attempts[attempts.length - 1];
    if (
      last &&
      last.kind === 'attempt' &&
      Math.abs(new Date(last.timestamp).getTime() - t) < WINDOW_MS
    ) {
      last.logs.push(log);
    } else {
      attempts.push({
        kind: 'attempt',
        key: `attempt-${log.created_at}-${log.id}`,
        timestamp: log.created_at,
        logs: [log],
      });
    }
  }
  for (const a of attempts) {
    if (a.kind === 'attempt') {
      a.logs.sort((x, y) => ATTEMPT_ORDER.indexOf(x.run_label) - ATTEMPT_ORDER.indexOf(y.run_label));
    }
  }

  // 2) Map overrides.
  const overrideEntries: TimelineEntry[] = overrides.map((o) => ({
    kind: 'override',
    key: `override-${o.id}`,
    timestamp: o.created_at,
    override: o,
  }));

  // 3) Merge and sort descending (most recent first).
  return [...attempts, ...overrideEntries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

interface OverrideModalProps {
  batchId: number;
  row: ReconcileMatch;
  onClose: () => void;
  onSaved: () => void;
}

function OverrideModal({ batchId, row, onClose, onSaved }: OverrideModalProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<'matched' | 'flagged'>(
    (row.status === 'flagged' ? 'flagged' : 'matched') as 'matched' | 'flagged'
  );
  const [reasoning, setReasoning] = useState(row.reasoning ?? '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const statusChanged = status !== row.status;
  const reasoningChanged = reasoning !== (row.reasoning ?? '');
  const canSave = !saving && (statusChanged || reasoningChanged);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/reconcile/${batchId}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_number: row.invoice_number,
          new_status: statusChanged ? status : undefined,
          new_reasoning: reasoningChanged ? reasoning : undefined,
          note: note.trim() ? note.trim() : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      onSaved();
    } catch (err) {
      toast({ variant: 'destructive', description: `Failed: ${(err as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
      <div className='w-full max-w-lg overflow-hidden rounded-sm border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950'>
        <header className='flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800'>
          <div>
            <p className='text-xs font-medium uppercase tracking-wider text-on-surface-variant dark:text-neutral-400'>
              Human override
            </p>
            <h2 className='mt-0.5 font-serif text-lg text-on-surface dark:text-white'>
              Invoice <span className='font-mono'>{row.invoice_number}</span>
            </h2>
          </div>
          <button
            type='button'
            onClick={onClose}
            disabled={saving}
            className='rounded-sm p-1.5 text-on-surface-variant hover:bg-zinc-100 dark:text-neutral-400 dark:hover:bg-zinc-900'
            aria-label='Close'
          >
            <IoCloseOutline className='h-5 w-5' />
          </button>
        </header>

        <div className='space-y-4 px-5 py-4'>
          <div>
            <label className='text-xs font-medium uppercase tracking-wider text-on-surface-variant dark:text-neutral-400'>
              Status
            </label>
            <div className='mt-2 flex gap-2'>
              {(['matched', 'flagged'] as const).map((opt) => (
                <button
                  type='button'
                  key={opt}
                  onClick={() => setStatus(opt)}
                  className={cn(
                    'flex-1 rounded-sm border px-3 py-2 text-sm font-medium capitalize transition-colors',
                    status === opt
                      ? 'border-on-surface bg-on-surface text-white dark:border-white dark:bg-white dark:text-black'
                      : 'border-zinc-300 bg-white text-on-surface hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900'
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor='override-reasoning'
              className='text-xs font-medium uppercase tracking-wider text-on-surface-variant dark:text-neutral-400'
            >
              Reasoning
            </label>
            <textarea
              id='override-reasoning'
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
              rows={4}
              className='mt-1 w-full rounded-sm border border-zinc-300 bg-white px-3 py-2 text-sm text-on-surface focus:border-on-surface focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-white'
            />
          </div>

          <div>
            <label
              htmlFor='override-note'
              className='text-xs font-medium uppercase tracking-wider text-on-surface-variant dark:text-neutral-400'
            >
              Note <span className='lowercase text-on-surface-variant dark:text-neutral-500'>(why you&rsquo;re overriding)</span>
            </label>
            <input
              id='override-note'
              type='text'
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder='e.g. Confirmed with vendor on phone — tax was reversed'
              className='mt-1 w-full rounded-sm border border-zinc-300 bg-white px-3 py-2 text-sm text-on-surface focus:border-on-surface focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-white'
            />
          </div>
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
            onClick={save}
            disabled={!canSave}
            className='rounded-sm bg-on-surface px-4 py-1.5 text-sm font-semibold text-white hover:bg-on-surface/90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200'
          >
            {saving ? 'Saving…' : 'Save override'}
          </button>
        </footer>
      </div>
    </div>
  );
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
