'use client';

import Link from 'next/link';
import {
  IoArrowBackOutline,
  IoBarChartOutline,
  IoNotificationsOutline,
  IoRefreshCircleOutline,
  IoSwapHorizontalOutline,
} from 'react-icons/io5';

interface RoadmapItem {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const ITEMS: RoadmapItem[] = [
  {
    title: 'Bank Feed / Payment Matching',
    description:
      'Automatically match cleared bank transactions to reconciled invoices for complete end-to-end AP automation. The same three-agent consensus model will tie payment artifacts to the line items they cleared.',
    icon: <IoSwapHorizontalOutline />,
  },
  {
    title: 'Intelligent Retry Logic',
    description:
      'Automatic retries with exponential backoff and clear, plain-English error explanations when an AI run fails. Flaky gateway responses never block the Office Manager\u2019s workflow.',
    icon: <IoRefreshCircleOutline />,
  },
  {
    title: 'Notifications via Email / Slack',
    description:
      'Real-time alerts sent to the Office Manager when high-oddity items require review or when a batch successfully completes. Configurable per-vendor thresholds and quiet hours.',
    icon: <IoNotificationsOutline />,
  },
  {
    title: 'Analytics Dashboard',
    description:
      'Visual metrics showing time saved, error-rate trends, ROI calculator, and monthly summary reports that prove the value of Ardent Advisors AI to business owners.',
    icon: <IoBarChartOutline />,
  },
];

export function RoadmapContent() {
  return (
    <div className='py-2 lg:py-3'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <p className='text-xs uppercase tracking-widest text-on-surface-variant dark:text-neutral-400'>
            Future Roadmap
          </p>
          <h1 className='mt-1 font-serif text-3xl font-normal leading-[1.05] tracking-tight text-on-surface dark:text-white lg:text-5xl'>
            What&rsquo;s Coming Next
          </h1>
        </div>
        <Link
          href='/dashboard'
          className='inline-flex items-center gap-1.5 rounded-sm border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900'
        >
          <IoArrowBackOutline className='h-4 w-4' />
          Back to reconciliation
        </Link>
      </div>
      <p className='mt-4 max-w-2xl text-sm leading-relaxed text-on-surface-variant dark:text-neutral-400'>
        The current reconciliation workflow is the foundation. Here is what we are building on top
        of it — each feature extends the same three-agent consensus engine you&rsquo;re using today.
      </p>

      <div className='mt-10 grid gap-4 sm:grid-cols-2'>
        {ITEMS.map((item) => (
          <article
            key={item.title}
            className='rounded-sm border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'
          >
            <div className='flex h-10 w-10 items-center justify-center rounded-sm bg-zinc-100 text-xl text-on-surface dark:bg-zinc-900 dark:text-white'>
              {item.icon}
            </div>
            <h2 className='mt-4 font-serif text-xl text-on-surface dark:text-white'>
              {item.title}
            </h2>
            <p className='mt-2 text-sm leading-relaxed text-on-surface-variant dark:text-neutral-400'>
              {item.description}
            </p>
            <span className='mt-4 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400'>
              Planned
            </span>
          </article>
        ))}
      </div>
    </div>
  );
}
