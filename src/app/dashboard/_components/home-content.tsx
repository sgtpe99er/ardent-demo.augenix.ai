'use client';

import Link from 'next/link';
import {
  IoAlertCircle,
  IoCheckmarkCircle,
  IoHelpCircleOutline,
  IoTimeOutline,
} from 'react-icons/io5';

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
  const pending = batches.filter((b) => b.status === 'pending' || b.status === 'running');
  const done = batches.filter((b) => b.status === 'complete' || b.status === 'error');

  return (
    <div className='py-2 lg:py-3'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <h1 className='font-serif text-3xl font-normal leading-[1.05] tracking-tight text-on-surface dark:text-white lg:text-5xl'>
          Vendor Statement Reconciliation
        </h1>
        <Link
          href='/dashboard/help'
          className='inline-flex items-center gap-1.5 rounded-sm border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900'
        >
          <IoHelpCircleOutline className='h-4 w-4' />
          How it works
        </Link>
      </div>
      <p className='mt-4 max-w-2xl text-sm leading-relaxed text-on-surface-variant dark:text-neutral-400'>
        Select a vendor statement below to run the three-agent consensus reconciliation against
        your Nexsyis invoices.
      </p>

      <Section title='Pending statements' subtitle='Awaiting reconciliation'>
        {pending.length === 0 ? (
          <Empty>No pending statements. Start a new period when your vendor sends theirs.</Empty>
        ) : (
          <BatchGrid batches={pending} />
        )}
      </Section>

      <Section title='Recent reconciliations' subtitle='Completed in this demo'>
        {done.length === 0 ? (
          <Empty>No completed reconciliations yet. Pick a pending statement to begin.</Empty>
        ) : (
          <BatchGrid batches={done} />
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className='mt-12'>
      <div className='mb-4 flex items-baseline justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800'>
        <h2 className='font-serif text-xl text-on-surface dark:text-white'>{title}</h2>
        <span className='font-serif text-xs italic text-on-surface-variant dark:text-neutral-500'>
          {subtitle}
        </span>
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

function BatchGrid({ batches }: { batches: Batch[] }) {
  return (
    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
      {batches.map((b) => (
        <Link
          key={b.id}
          href={`/dashboard/reconcile/${b.id}`}
          className='group flex flex-col rounded-sm border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600'
        >
          <div className='flex items-center justify-between'>
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
      ))}
    </div>
  );
}
