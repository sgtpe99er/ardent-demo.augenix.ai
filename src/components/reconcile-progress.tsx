'use client';

import {
  IoAlertCircle,
  IoCheckmarkCircle,
  IoEllipseOutline,
  IoTimeOutline,
} from 'react-icons/io5';

import { cn } from '@/utils/cn';

export type StepStatus = 'pending' | 'running' | 'complete' | 'error';

export interface StepState {
  key: string;
  label: string;
  description: string;
  model: string;
  status: StepStatus;
  durationMs?: number;
  error?: string;
}

/** Canonical ordered list of pipeline steps. */
export function makeInitialSteps(): StepState[] {
  return [
    {
      key: 'run_1',
      label: 'Initial Reconciliation 1',
      description: 'system-prompt.md + user-prompt-template.md',
      model: 'xai/grok-4-fast-non-reasoning',
      status: 'pending',
    },
    {
      key: 'run_2',
      label: 'Initial Reconciliation 2',
      description: 'system-prompt.md + user-prompt-template.md',
      model: 'google/gemini-3-flash',
      status: 'pending',
    },
    {
      key: 'run_3',
      label: 'Initial Reconciliation 3',
      description: 'system-prompt.md + user-prompt-template.md',
      model: 'xai/grok-4.20-multi-agent',
      status: 'pending',
    },
    {
      key: 'consensus',
      label: 'Consensus / Final Audit',
      description: 'consensus-prompt.md',
      model: 'xai/grok-4-fast-non-reasoning',
      status: 'pending',
    },
  ];
}

/** Apply an incoming NDJSON progress event to a step list. */
export function applyProgressEvent(
  steps: StepState[],
  event: { type: string; step?: string; model?: string; duration_ms?: number; error?: string }
): StepState[] {
  if (!event.step) return steps;
  return steps.map((s) => {
    if (s.key !== event.step) return s;
    if (event.type === 'step_start') return { ...s, status: 'running' };
    if (event.type === 'step_complete')
      return { ...s, status: 'complete', durationMs: event.duration_ms };
    if (event.type === 'step_error')
      return { ...s, status: 'error', error: event.error };
    return s;
  });
}

interface ReconcileProgressProps {
  steps: StepState[];
  /** Optional: show an overall label above the steps (e.g. vendor name). */
  heading?: string;
  className?: string;
}

export function ReconcileProgress({ steps, heading, className }: ReconcileProgressProps) {
  const total = steps.length;
  const done = steps.filter((s) => s.status === 'complete').length;
  const hasError = steps.some((s) => s.status === 'error');
  const pct = Math.round((done / total) * 100);

  return (
    <div
      className={cn(
        'rounded-sm border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950',
        className
      )}
    >
      {heading && (
        <p className='mb-1 text-xs font-medium uppercase tracking-wider text-on-surface-variant dark:text-neutral-400'>
          {heading}
        </p>
      )}
      <div className='mb-4 flex items-center justify-between gap-4'>
        <div className='text-sm font-semibold text-on-surface dark:text-white'>
          {hasError
            ? 'Run failed'
            : done === total
            ? 'Run complete'
            : done === 0
            ? 'Starting agents…'
            : `Running step ${done + 1} of ${total}`}
        </div>
        <div className='text-xs tabular-nums text-on-surface-variant dark:text-neutral-400'>
          {done}/{total}
        </div>
      </div>

      <div className='mb-5 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900'>
        <div
          className={cn(
            'h-full transition-all duration-300',
            hasError ? 'bg-red-500' : 'bg-on-surface dark:bg-white'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className='space-y-3'>
        {steps.map((s) => (
          <li key={s.key} className='flex items-start gap-3'>
            <StepIcon status={s.status} />
            <div className='min-w-0 flex-1'>
              <div className='flex items-center justify-between gap-2'>
                <p className='text-sm font-medium text-on-surface dark:text-white'>
                  {s.label}
                </p>
                <StepBadge status={s.status} durationMs={s.durationMs} />
              </div>
              <p className='mt-0.5 font-mono text-[11px] text-on-surface-variant dark:text-neutral-500'>
                {s.model}
              </p>
              <p className='font-mono text-[11px] text-on-surface-variant dark:text-neutral-500'>
                {s.description}
              </p>
              {s.error && (
                <p className='mt-1 text-xs text-red-600 dark:text-red-400'>{s.error}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'complete')
    return <IoCheckmarkCircle className='mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400' />;
  if (status === 'error')
    return <IoAlertCircle className='mt-0.5 h-5 w-5 text-red-600 dark:text-red-400' />;
  if (status === 'running')
    return (
      <span className='mt-1 flex h-4 w-4 items-center justify-center'>
        <span className='h-3 w-3 animate-ping rounded-full bg-on-surface opacity-60 dark:bg-white' />
        <span className='absolute h-2 w-2 rounded-full bg-on-surface dark:bg-white' />
      </span>
    );
  return <IoEllipseOutline className='mt-0.5 h-5 w-5 text-zinc-300 dark:text-zinc-700' />;
}

function StepBadge({ status, durationMs }: { status: StepStatus; durationMs?: number }) {
  const base =
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider';
  if (status === 'complete')
    return (
      <span className={cn(base, 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300')}>
        Complete {durationMs ? `· ${(durationMs / 1000).toFixed(1)}s` : ''}
      </span>
    );
  if (status === 'error')
    return (
      <span className={cn(base, 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300')}>
        Failed
      </span>
    );
  if (status === 'running')
    return (
      <span className={cn(base, 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300')}>
        <IoTimeOutline /> Running
      </span>
    );
  return (
    <span className={cn(base, 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400')}>
      Pending
    </span>
  );
}

/**
 * Helper: consume an NDJSON response body and invoke `onEvent` per line.
 * Closes cleanly at end of stream.
 */
export async function consumeNdjson(
  response: Response,
  onEvent: (event: Record<string, unknown>) => void
): Promise<void> {
  if (!response.body) throw new Error('Response has no body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        onEvent(JSON.parse(trimmed));
      } catch {
        /* ignore malformed chunks */
      }
    }
  }
  if (buffer.trim()) {
    try {
      onEvent(JSON.parse(buffer));
    } catch {
      /* ignore */
    }
  }
}
