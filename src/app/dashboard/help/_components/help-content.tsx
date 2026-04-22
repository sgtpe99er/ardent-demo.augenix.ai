'use client';

import Link from 'next/link';
import {
  IoArrowBack,
  IoCheckmarkCircle,
  IoDocumentTextOutline,
  IoDownloadOutline,
  IoGitMergeOutline,
  IoPlayCircle,
  IoRefresh,
  IoShieldCheckmarkOutline,
  IoSparklesOutline,
} from 'react-icons/io5';

export function HelpContent() {
  return (
    <div className='py-8 lg:py-12'>
      <Link
        href='/dashboard'
        className='inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-on-surface-variant hover:text-on-surface dark:text-neutral-400 dark:hover:text-white'
      >
        <IoArrowBack className='h-3.5 w-3.5' /> Back to reconciliation
      </Link>

      <header className='mt-4 border-b border-zinc-200 pb-6 dark:border-zinc-800'>
        <p className='font-sans text-xs uppercase tracking-[0.2em] text-on-surface-variant dark:text-neutral-400'>
          Help · How it works
        </p>
        <h1 className='mt-2 font-serif text-3xl font-normal tracking-tight text-on-surface dark:text-white lg:text-5xl'>
          The <span className='italic'>three-agent consensus</span> reconciliation
        </h1>
        <p className='mt-4 max-w-2xl text-sm leading-relaxed text-on-surface-variant dark:text-neutral-400'>
          Every vendor statement is reconciled by <strong>three independent AI agents</strong>{' '}
          running in parallel, then audited by a fourth <strong>consensus agent</strong>. This page
          explains exactly what happens behind the scenes and how to use the interface as an Office
          Manager.
        </p>
      </header>

      {/* DIAGRAM */}
      <section className='mt-10'>
        <h2 className='font-serif text-2xl text-on-surface dark:text-white'>The pipeline</h2>
        <p className='mt-2 max-w-2xl text-sm text-on-surface-variant dark:text-neutral-400'>
          A reconciliation run takes ~10–20 seconds. Here is every step, from pulling unpaid
          invoices out of Nexsyis to posting the approved adjustments back.
        </p>

        <div className='mt-6 rounded-sm border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 lg:p-10'>
          <PipelineDiagram />
        </div>
      </section>

      {/* STEPS IN DETAIL */}
      <section className='mt-12'>
        <h2 className='font-serif text-2xl text-on-surface dark:text-white'>What happens, step by step</h2>
        <ol className='mt-4 space-y-4'>
          <Step
            n={1}
            title='Gather the inputs'
            icon={<IoDocumentTextOutline />}
            body='The system pulls the vendor statement, the statement period, the total due, and every unpaid invoice from Nexsyis for that vendor and period. All values are sent to the AI as structured data — no screenshots or guesswork.'
          />
          <Step
            n={2}
            title='Run three agents in parallel'
            icon={<IoSparklesOutline />}
            body='The same prompt is sent to three independent models from different providers — xAI Grok-4-fast for a cheap, deterministic baseline; Google Gemini-3-flash for strong numeric/JSON precision; and xAI Grok-4.20-multi-agent for tricky multi-step discrepancies. Cross-provider diversity catches different classes of errors a single model would miss.'
          />
          <Step
            n={3}
            title='Fourth agent audits the three'
            icon={<IoGitMergeOutline />}
            body='A fourth "consensus auditor" agent receives all three JSON outputs and produces the final answer. Rules are strict: majority vote for disagreements, the most conservative option when tied, averaged confidence, and any line below 85% confidence is automatically escalated to "Needs Review".'
          />
          <Step
            n={4}
            title='Everything is written to an audit log'
            icon={<IoShieldCheckmarkOutline />}
            body='All three individual runs and the final consensus are stored in the database with timestamps, model names, and durations. You can open the "Show audit log" toggle on any batch to see exactly what each agent said.'
          />
          <Step
            n={5}
            title='You review, re-run, or export'
            icon={<IoCheckmarkCircle />}
            body='Green rows matched cleanly. Amber rows are flagged with a human-readable explanation (e.g. "Amount differs by $247 — possible tax adjustment"). You can re-run a single line with the "Re-run AI" button or export the full consensus result to CSV.'
          />
        </ol>
      </section>

      {/* HOW TO USE */}
      <section className='mt-12'>
        <h2 className='font-serif text-2xl text-on-surface dark:text-white'>How to use the page</h2>
        <div className='mt-4 grid gap-4 md:grid-cols-2'>
          <Tile
            icon={<IoDocumentTextOutline />}
            title='1 · Pick a statement'
            body='From the home screen, click the vendor card under "Pending statements".'
          />
          <Tile
            icon={<IoPlayCircle />}
            title='2 · Run reconciliation'
            body='Click the black "Run reconciliation" button in the top right. The three agents will stream through in ~15 seconds.'
          />
          <Tile
            icon={<IoCheckmarkCircle />}
            title='3 · Review the results'
            body='Matched lines are green. Flagged lines show the oddity (amount mismatch, missing credit, duplicate, wrong LK) with a confidence bar.'
          />
          <Tile
            icon={<IoRefresh />}
            title='4 · Re-run a single line'
            body='Not convinced by a flag? Click "Re-run AI" on any row to re-execute the full 3-agent consensus for just that invoice.'
          />
          <Tile
            icon={<IoShieldCheckmarkOutline />}
            title='5 · Open the audit log'
            body='Toggle "Show audit log" to see each agent&apos;s raw JSON — great for demonstrating transparency to partners.'
          />
          <Tile
            icon={<IoDownloadOutline />}
            title='6 · Export to CSV'
            body='Hit "Export CSV" to hand the final reconciliation to your accountant or import it into your AP workflow.'
          />
        </div>
      </section>

      {/* WHY 3+1 */}
      <section className='mt-12 rounded-sm border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-950 lg:p-8'>
        <h2 className='font-serif text-xl text-on-surface dark:text-white'>
          Why three agents plus a consensus auditor?
        </h2>
        <p className='mt-3 max-w-3xl text-sm leading-relaxed text-on-surface-variant dark:text-neutral-400'>
          Single-agent AI reconciliation looks fast but occasionally misses subtle issues like a
          tax adjustment disguised as a $247 discrepancy, or a duplicated invoice date. By running
          three independent reasoning passes and auditing them against each other, we surface
          disagreements as explicit low-confidence flags instead of burying them. Every flag ships
          with plain-English reasoning you can read, share, and act on.
        </p>
      </section>

      <div className='mt-10 flex justify-end'>
        <Link
          href='/dashboard'
          className='inline-flex items-center gap-2 rounded-sm bg-on-surface px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-surface/90 dark:bg-white dark:text-black dark:hover:bg-zinc-200'
        >
          <IoPlayCircle className='h-4 w-4' /> Back to reconciliation
        </Link>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pipeline Diagram                                                          */
/* -------------------------------------------------------------------------- */

function PipelineDiagram() {
  return (
    <svg
      viewBox='0 0 640 1100'
      className='h-auto w-full max-w-[560px] mx-auto text-on-surface dark:text-white'
      role='img'
      aria-label='Reconciliation pipeline diagram'
    >
      <defs>
        <marker
          id='arrow'
          viewBox='0 0 10 10'
          refX='8'
          refY='5'
          markerWidth='6'
          markerHeight='6'
          orient='auto-start-reverse'
        >
          <path d='M 0 0 L 10 5 L 0 10 z' fill='currentColor' opacity='0.6' />
        </marker>
      </defs>

      {/* ============== Nexsyis pull ============== */}
      <g>
        <rect
          x='180' y='20' width='280' height='110' rx='4'
          className='fill-white stroke-zinc-400 dark:fill-zinc-900 dark:stroke-zinc-600'
          strokeWidth='1.5'
        />
        <text x='320' y='58' textAnchor='middle' className='fill-current font-serif text-[20px]' fontStyle='italic'>Nexsyis</text>
        <text x='320' y='88' textAnchor='middle' className='fill-current text-[15px]' opacity='0.8'>Pull unpaid invoices</text>
        <text x='320' y='110' textAnchor='middle' className='fill-current text-[15px]' opacity='0.8'>via API</text>
      </g>

      {/* Arrow Nexsyis → Inputs */}
      <line x1='320' y1='130' x2='320' y2='168' stroke='currentColor' strokeWidth='1.5' opacity='0.5' markerEnd='url(#arrow)' />

      {/* ============== Inputs ============== */}
      <g>
        <rect
          x='180' y='170' width='280' height='140' rx='4'
          className='fill-white stroke-zinc-400 dark:fill-zinc-900 dark:stroke-zinc-600'
          strokeWidth='1.5'
        />
        <text x='320' y='206' textAnchor='middle' className='fill-current font-serif text-[20px]' fontStyle='italic'>Inputs</text>
        <text x='320' y='236' textAnchor='middle' className='fill-current text-[15px]' opacity='0.8'>Vendor statement</text>
        <text x='320' y='258' textAnchor='middle' className='fill-current text-[15px]' opacity='0.8'>Invoices</text>
        <text x='320' y='280' textAnchor='middle' className='fill-current text-[15px]' opacity='0.8'>Period · Total due</text>
      </g>

      {/* Fan-out arrows Inputs → Agents */}
      <line x1='320' y1='310' x2='110' y2='378' stroke='currentColor' strokeWidth='1.5' opacity='0.5' markerEnd='url(#arrow)' />
      <line x1='320' y1='310' x2='320' y2='378' stroke='currentColor' strokeWidth='1.5' opacity='0.5' markerEnd='url(#arrow)' />
      <line x1='320' y1='310' x2='530' y2='378' stroke='currentColor' strokeWidth='1.5' opacity='0.5' markerEnd='url(#arrow)' />

      {/* 3 agents in a row — different models for diversity */}
      <Agent x={20}  y={380} label='Agent 1' model='grok-4-fast' />
      <Agent x={230} y={380} label='Agent 2' model='gemini-3-flash' />
      <Agent x={440} y={380} label='Agent 3' model='grok-4.20-multi' />

      {/* Fan-in arrows Agents → Consensus */}
      <line x1='110' y1='480' x2='320' y2='538' stroke='currentColor' strokeWidth='1.5' opacity='0.5' markerEnd='url(#arrow)' />
      <line x1='320' y1='480' x2='320' y2='538' stroke='currentColor' strokeWidth='1.5' opacity='0.5' markerEnd='url(#arrow)' />
      <line x1='530' y1='480' x2='320' y2='538' stroke='currentColor' strokeWidth='1.5' opacity='0.5' markerEnd='url(#arrow)' />

      {/* Consensus */}
      <g>
        <rect x='150' y='540' width='340' height='170' rx='4' className='fill-zinc-900 dark:fill-white' />
        <text x='320' y='578' textAnchor='middle' className='fill-white dark:fill-zinc-900 font-serif text-[20px]' fontStyle='italic'>Consensus</text>
        <text x='320' y='602' textAnchor='middle' className='fill-white dark:fill-zinc-900 font-mono text-[12px]' opacity='0.75'>grok-4-fast</text>
        <text x='320' y='632' textAnchor='middle' className='fill-white dark:fill-zinc-900 text-[15px]' opacity='0.9'>Majority vote</text>
        <text x='320' y='658' textAnchor='middle' className='fill-white dark:fill-zinc-900 text-[15px]' opacity='0.9'>Conservative tie-break</text>
        <text x='320' y='684' textAnchor='middle' className='fill-white dark:fill-zinc-900 text-[15px]' opacity='0.9'>Force flag if &lt; 85% confidence</text>
      </g>

      {/* Arrow Consensus → Output */}
      <line x1='320' y1='710' x2='320' y2='748' stroke='currentColor' strokeWidth='1.5' opacity='0.5' markerEnd='url(#arrow)' />

      {/* Output box */}
      <g>
        <rect
          x='180' y='750' width='280' height='130' rx='4'
          className='fill-white stroke-zinc-400 dark:fill-zinc-900 dark:stroke-zinc-600'
          strokeWidth='1.5'
        />
        <text x='320' y='786' textAnchor='middle' className='fill-current font-serif text-[20px]' fontStyle='italic'>Results</text>
        <text x='320' y='816' textAnchor='middle' className='fill-current text-[15px]' opacity='0.8'>Matches + Flags</text>
        <text x='320' y='840' textAnchor='middle' className='fill-current text-[15px]' opacity='0.8'>Confidence + Reasoning</text>
        <text x='320' y='864' textAnchor='middle' className='fill-current text-[15px]' opacity='0.8'>Audit trail</text>
      </g>

      {/* Arrow Output → Nexsyis push */}
      <line x1='320' y1='880' x2='320' y2='918' stroke='currentColor' strokeWidth='1.5' opacity='0.5' markerEnd='url(#arrow)' />

      {/* Nexsyis push */}
      <g>
        <rect
          x='180' y='920' width='280' height='130' rx='4'
          className='fill-white stroke-zinc-400 dark:fill-zinc-900 dark:stroke-zinc-600'
          strokeWidth='1.5'
        />
        <text x='320' y='958' textAnchor='middle' className='fill-current font-serif text-[20px]' fontStyle='italic'>Nexsyis</text>
        <text x='320' y='990' textAnchor='middle' className='fill-current text-[15px]' opacity='0.8'>Post adjustments</text>
        <text x='320' y='1012' textAnchor='middle' className='fill-current text-[15px]' opacity='0.8'>& close period</text>
      </g>

      {/* Audit log — side branch off Consensus */}
      <line
        x1='490' y1='625' x2='540' y2='625'
        stroke='currentColor' strokeWidth='1.2' strokeDasharray='4 3' opacity='0.5'
        markerEnd='url(#arrow)'
      />
      <rect
        x='540' y='600' width='100' height='50' rx='4'
        className='fill-zinc-100 stroke-zinc-300 dark:fill-zinc-900 dark:stroke-zinc-700'
        strokeWidth='1'
      />
      <text x='590' y='624' textAnchor='middle' className='fill-current text-[13px]' opacity='0.85'>Audit log</text>
      <text x='590' y='640' textAnchor='middle' className='fill-current text-[12px]' opacity='0.6'>every run</text>
    </svg>
  );
}

function Agent({
  x,
  y,
  label,
  model,
}: {
  x: number;
  y: number;
  label: string;
  model: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width='180'
        height='100'
        rx='4'
        className='fill-white stroke-zinc-400 dark:fill-zinc-900 dark:stroke-zinc-600'
        strokeWidth='1.5'
      />
      <text
        x={x + 90}
        y={y + 48}
        textAnchor='middle'
        className='fill-current font-serif text-[18px]'
      >
        {label}
      </text>
      <text
        x={x + 90}
        y={y + 74}
        textAnchor='middle'
        className='fill-current font-mono text-[12px]'
        opacity='0.75'
      >
        {model}
      </text>
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/*  Small components                                                          */
/* -------------------------------------------------------------------------- */

function Step({
  n,
  title,
  body,
  icon,
}: {
  n: number;
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <li className='flex gap-4 rounded-sm border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950'>
      <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-lg text-on-surface dark:bg-zinc-900 dark:text-white'>
        {icon}
      </div>
      <div className='flex-1'>
        <div className='flex items-baseline gap-2'>
          <span className='font-mono text-[10px] uppercase tracking-wider text-on-surface-variant dark:text-neutral-500'>
            Step {n}
          </span>
          <h3 className='font-serif text-lg text-on-surface dark:text-white'>{title}</h3>
        </div>
        <p className='mt-1 text-sm leading-relaxed text-on-surface-variant dark:text-neutral-400'>
          {body}
        </p>
      </div>
    </li>
  );
}

function Tile({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className='rounded-sm border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950'>
      <div className='flex items-center gap-2 text-on-surface dark:text-white'>
        <span className='text-lg'>{icon}</span>
        <h3 className='font-serif text-base'>{title}</h3>
      </div>
      <p className='mt-2 text-xs leading-relaxed text-on-surface-variant dark:text-neutral-400'>
        {body}
      </p>
    </div>
  );
}
