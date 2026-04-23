'use client';

import Link from 'next/link';
import {
  IoAnalyticsOutline,
  IoArrowBackOutline,
  IoBarChartOutline,
  IoBusinessOutline,
  IoCalendarOutline,
  IoCardOutline,
  IoChatbubblesOutline,
  IoCheckmarkCircle,
  IoCheckmarkDoneOutline,
  IoMailOutline,
  IoPeopleOutline,
  IoPhonePortraitOutline,
  IoRefreshCircleOutline,
  IoShieldCheckmarkOutline,
  IoSparklesOutline,
  IoSwapHorizontalOutline,
  IoTrendingUpOutline,
} from 'react-icons/io5';

interface RoadmapItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'included' | 'planned';
}

const ITEMS: RoadmapItem[] = [
  // -----------------------------------------------------------------------
  // Already included in the current demo
  // -----------------------------------------------------------------------
  {
    title: 'Analytics Dashboard',
    status: 'included',
    description:
      'Visual metrics showing time saved, error-rate trends, ROI calculator, and monthly summary reports that prove the value of Ardent Advisors AI to business owners.',
    icon: <IoBarChartOutline />,
  },
  {
    title: 'Email Notifications',
    status: 'included',
    description:
      'Real-time alerts sent to the Office Manager when high-oddity items require review or when a batch successfully completes. Configurable per-vendor thresholds and quiet hours. Slack and Teams integrations are planned as future add-ons.',
    icon: <IoMailOutline />,
  },

  // -----------------------------------------------------------------------
  // Planned — intelligence layer
  // -----------------------------------------------------------------------
  {
    title: 'Payment Processing Hand-off',
    status: 'planned',
    description:
      'The "Start check run" button shown after finalize is currently a mockup preview. Production will write the approved batch directly to Nexsyis\u2019 Payment Processing module, producing printed checks or an ACH file with zero re-keying.',
    icon: <IoCardOutline />,
  },
  {
    title: 'Vendor-Specific Learned Patterns',
    status: 'planned',
    description:
      'The system builds a profile per vendor — how they invoice, whether tax and core charges appear on separate lines, which invoice-number format they use, typical volume bands — and applies those heuristics on future batches so matching gets more accurate with every statement.',
    icon: <IoBusinessOutline />,
  },
  {
    title: 'Learning from Overrides',
    status: 'planned',
    description:
      'Every human override becomes a training signal. When an Office Manager clears a flagged row ("this core charge is expected"), the consensus engine weights that pattern for future runs and stops re-flagging the same oddity across the vendor base.',
    icon: <IoSparklesOutline />,
  },
  {
    title: 'Confidence-Tuned Auto-Finalize',
    status: 'planned',
    description:
      'If a batch reaches 100% matched with zero flags and clears a per-vendor confidence threshold, allow opt-in auto-finalization with a 24-hour grace period for human review. Cuts Office Manager time to zero on clean batches.',
    icon: <IoCheckmarkDoneOutline />,
  },
  {
    title: 'Anomaly Detection Across Time',
    status: 'planned',
    description:
      'Flag statements that deviate from a vendor\u2019s historical pattern — sudden 3x volume, unfamiliar LK codes, unusual credit memos, amounts outside learned bands — independent of line-item matching. Catches the oddities a single-batch view can\u2019t.',
    icon: <IoTrendingUpOutline />,
  },

  // -----------------------------------------------------------------------
  // Planned — workflow & scale
  // -----------------------------------------------------------------------
  {
    title: 'Scheduled Batch Runs',
    status: 'planned',
    description:
      'Cron-style automation: "Every Monday at 6am, run reconciliation for every vendor with an uploaded statement from last week." Results appear as pending review when the Office Manager logs in — no manual kickoff required.',
    icon: <IoCalendarOutline />,
  },
  {
    title: 'Multi-User Assignment & Review Queue',
    status: 'planned',
    description:
      'Larger shops have multiple AP clerks. Batches can be assigned, reassigned, and worked through a personal "My Queue" view alongside the shared "Team Queue," with clear ownership on every line.',
    icon: <IoPeopleOutline />,
  },
  {
    title: 'Approval Workflow / Two-Person Finalize',
    status: 'planned',
    description:
      'For batches over a configurable dollar threshold or with more than N flagged items, require a second reviewer\u2019s sign-off before the Finalize button unlocks. Enforces segregation of duties and audit-grade quality control.',
    icon: <IoShieldCheckmarkOutline />,
  },
  {
    title: 'Vendor Self-Service Portal',
    status: 'planned',
    description:
      'Vendors log in to see their own statement status and resolved discrepancies, and upload statements directly. As a lighter alternative, each vendor also gets a unique inbound email address — forwarding any statement to statements+{vendor-id}@ardent.ai will ingest it automatically. Dramatically reduces statement-chasing emails either way.',
    icon: <IoBusinessOutline />,
  },

  // -----------------------------------------------------------------------
  // Planned — reach & platform
  // -----------------------------------------------------------------------
  {
    title: 'Chat With Your Reconciliation',
    status: 'planned',
    description:
      'Natural-language search across all historical batches: "Show me every statement where Vendor A had tax discrepancies this quarter," or "Which vendors had the most core-charge flags in 2026?" Plain-English answers backed by the existing audit trail.',
    icon: <IoChatbubblesOutline />,
  },
  {
    title: 'Mobile-Friendly PWA with Push Notifications',
    status: 'planned',
    description:
      'Installable Progressive Web App optimized for phone and tablet. Office Managers and shop owners get push notifications when a batch needs review, open the app, swipe through flagged rows, and approve or override — no desk required. Works offline for reviewing finalized batches.',
    icon: <IoPhonePortraitOutline />,
  },
  {
    title: 'Bank Feed / Payment Matching',
    status: 'planned',
    description:
      'Automatically match cleared bank transactions to reconciled invoices for complete end-to-end AP automation. The same three-agent consensus model ties payment artifacts to the line items they cleared.',
    icon: <IoSwapHorizontalOutline />,
  },
  {
    title: 'Intelligent Retry Logic',
    status: 'planned',
    description:
      'Automatic retries with exponential backoff and clear, plain-English error explanations when an AI run fails. Flaky gateway responses never block the Office Manager\u2019s workflow.',
    icon: <IoRefreshCircleOutline />,
  },
];

export function RoadmapContent() {
  const included = ITEMS.filter((i) => i.status === 'included');
  const planned = ITEMS.filter((i) => i.status === 'planned');

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
        The current reconciliation workflow is the foundation. Here is what we ship today and what
        we are building on top of it — every feature extends the same three-agent consensus engine
        you&rsquo;re using right now.
      </p>

      <section className='mt-10'>
        <div className='mb-4 flex items-center gap-2'>
          <IoCheckmarkCircle className='h-5 w-5 text-emerald-600 dark:text-emerald-400' />
          <h2 className='font-serif text-xl text-on-surface dark:text-white'>Included today</h2>
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          {included.map((item) => (
            <RoadmapCard key={item.title} item={item} />
          ))}
        </div>
      </section>

      <section className='mt-10'>
        <div className='mb-4 flex items-center gap-2'>
          <IoAnalyticsOutline className='h-5 w-5 text-on-surface-variant dark:text-neutral-400' />
          <h2 className='font-serif text-xl text-on-surface dark:text-white'>On the roadmap</h2>
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          {planned.map((item) => (
            <RoadmapCard key={item.title} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}

function RoadmapCard({ item }: { item: RoadmapItem }) {
  const isIncluded = item.status === 'included';
  return (
    <article
      className={
        'rounded-sm border p-6 ' +
        (isIncluded
          ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20'
          : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950')
      }
    >
      <div
        className={
          'flex h-10 w-10 items-center justify-center rounded-sm text-xl ' +
          (isIncluded
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            : 'bg-zinc-100 text-on-surface dark:bg-zinc-900 dark:text-white')
        }
      >
        {item.icon}
      </div>
      <h3 className='mt-4 font-serif text-xl text-on-surface dark:text-white'>{item.title}</h3>
      <p className='mt-2 text-sm leading-relaxed text-on-surface-variant dark:text-neutral-400'>
        {item.description}
      </p>
      <span
        className={
          'mt-4 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ' +
          (isIncluded
            ? 'bg-emerald-600 text-white'
            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400')
        }
      >
        {isIncluded && <IoCheckmarkCircle className='h-3 w-3' />}
        {isIncluded ? 'Included' : 'Planned'}
      </span>
    </article>
  );
}
