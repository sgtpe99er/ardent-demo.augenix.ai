'use client';

import Link from 'next/link';
import {
  IoArrowBack,
  IoCardOutline,
  IoCheckmarkCircle,
  IoCloudUploadOutline,
  IoCreateOutline,
  IoDocumentTextOutline,
  IoDownloadOutline,
  IoGitMergeOutline,
  IoLockClosed,
  IoLockOpenOutline,
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
            body='A fourth "consensus auditor" agent receives all three JSON outputs and produces the final answer. Rules are strict: majority vote for disagreements, the most conservative option when tied, averaged confidence, and any line below 85% confidence is automatically escalated to Flagged.'
          />
          <Step
            n={4}
            title='Batch lands in "Needs Review"'
            icon={<IoCheckmarkCircle />}
            body='Reconciliation does not auto-finalize. The batch moves to "Needs Review" so the Office Manager can inspect every flagged row. Green rows matched cleanly. Amber rows carry a human-readable explanation (e.g. "Amount differs by $247 — possible tax adjustment") and a confidence score.'
          />
          <Step
            n={5}
            title='Override or re-run as needed'
            icon={<IoCreateOutline />}
            body='Click "Re-run AI" on any row to re-execute the full 3-agent consensus for just that invoice. Or click "Override" to change a flagged row to matched (or vice versa), rewrite the reasoning, and attach a note. Every override is stored with before/after values and appears in the edit history.'
          />
          <Step
            n={6}
            title='Finalize the batch'
            icon={<IoLockClosed />}
            body='When you are satisfied, click the emerald "Finalize batch" button. A summary modal shows match rate, matched / flagged counts, human overrides, and net variance, with an "I have reviewed all oddities" checkbox that gates the action. Finalizing locks the batch and flips every invoice in the period to ready-to-pay.'
          />
          <Step
            n={7}
            title='Sync to Nexsyis & hand off to payments'
            icon={<IoCloudUploadOutline />}
            body='After finalizing, use "Sync to Nexsyis" to push the reconciled batch back (locks the statement, applies adjustments, links imaging documents — currently simulated with a mock transaction id) and "Start check run" to hand the approved invoices to the payment processing module (mock preview today). Need to make more edits? Un-finalize to re-open the batch.'
          />
          <Step
            n={8}
            title='Every action is in the edit history'
            icon={<IoShieldCheckmarkOutline />}
            body='All three AI runs, the consensus, every human override, and every lifecycle event (Finalize, Un-finalize, Nexsyis sync) are stored in the database with timestamps, model names, durations, and user emails. Toggle "Show edit history" on any batch to see the complete chronology.'
          />
        </ol>
      </section>

      {/* LIFECYCLE */}
      <section className='mt-12 rounded-sm border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 lg:p-8'>
        <h2 className='font-serif text-2xl text-on-surface dark:text-white'>
          The lifecycle of a batch
        </h2>
        <p className='mt-3 max-w-3xl text-sm leading-relaxed text-on-surface-variant dark:text-neutral-400'>
          Every vendor statement moves through five clearly-separated states. Nothing happens
          automatically after reconciliation — a deliberate human action is always required to
          finalize and to push data back to Nexsyis.
        </p>
        <ol className='mt-5 space-y-2 text-sm'>
          <LifecycleRow code='pending' label='Pending' body='Seeded or reset. No AI runs yet.' />
          <LifecycleRow code='running' label='Running' body='Three agents executing in parallel; consensus pending.' />
          <LifecycleRow
            code='needs_review'
            label='Needs Review'
            body='Results ready. Office Manager reviews flagged rows, re-runs lines, and applies overrides.'
          />
          <LifecycleRow
            code='complete'
            label='Complete · Finalized'
            body='Locked. Invoices marked ready-to-pay. Optional Sync to Nexsyis and Start check run become available.'
            emerald
          />
          <LifecycleRow
            code='needs_review'
            label='Un-finalized'
            body='Reverted from Complete. Invoices returned to unpaid. Batch is editable again.'
            amber
          />
        </ol>
      </section>

      {/* HOW TO USE */}
      <section className='mt-12'>
        <h2 className='font-serif text-2xl text-on-surface dark:text-white'>Every button on the reconcile page</h2>
        <div className='mt-4 grid gap-4 md:grid-cols-2'>
          <Tile
            icon={<IoDocumentTextOutline />}
            title='Pick a statement'
            body='From the home screen, click a vendor card. You can also select multiple vendors and hit "Run Batch Reconciliation" to sweep them sequentially.'
          />
          <Tile
            icon={<IoPlayCircle />}
            title='Run reconciliation'
            body='Black button, top right. The three agents stream through in ~15 seconds; a live step list shows each phase.'
          />
          <Tile
            icon={<IoCheckmarkCircle />}
            title='Review the results'
            body='Matched rows are green. Flagged rows show the oddity (amount mismatch, missing credit, duplicate, wrong LK code) with a confidence bar.'
          />
          <Tile
            icon={<IoRefresh />}
            title='Re-run a single line'
            body='Not convinced by a flag? Click "Re-run AI" on any row to re-execute the full 3-agent consensus for just that invoice.'
          />
          <Tile
            icon={<IoCreateOutline />}
            title='Override a row'
            body='Click "Override" on any row to change status (matched ↔ flagged), rewrite the reasoning, and add a note. Before/after values are kept forever in the audit trail.'
          />
          <Tile
            icon={<IoLockClosed />}
            title='Finalize the batch'
            body='Emerald button. Opens a summary modal (match rate, flags, overrides, net variance, remaining warnings) with an "I have reviewed" checkbox gate. Locks the batch; flips invoices to ready-to-pay.'
          />
          <Tile
            icon={<IoCloudUploadOutline />}
            title='Sync to Nexsyis'
            body='After finalize, push the approved batch to Nexsyis — locks the statement, applies adjustments, links imaging. Demo mode generates a mock transaction id (real integration coming).'
          />
          <Tile
            icon={<IoCardOutline />}
            title='Start check run'
            body='After finalize, preview the mock check run (sequential check numbers, amounts, queued status) that would be handed off to Payment Processing.'
          />
          <Tile
            icon={<IoLockOpenOutline />}
            title='Un-finalize batch'
            body='Need to make more edits? Un-finalize reverts the batch to Needs Review, flips invoices back to unpaid, and clears any Nexsyis sync id.'
          />
          <Tile
            icon={<IoShieldCheckmarkOutline />}
            title='Show edit history'
            body='Complete chronology of the batch — AI attempts, every human override (with before/after diff and note), and every lifecycle event (Finalize / Un-finalize / Sync to Nexsyis). Great for proving transparency to auditors.'
          />
          <Tile
            icon={<IoDownloadOutline />}
            title='Export to CSV'
            body='Hand the final reconciliation to your accountant or drop it into your AP workflow.'
          />
          <Tile
            icon={<IoRefresh />}
            title='Reset demo data'
            body='From the home page, clears all reconciliation state and returns every batch to Pending. Safe to run any time.'
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
      viewBox='-100 0 980 1580'
      className='h-auto w-full max-w-[760px] mx-auto text-on-surface dark:text-white'
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

      {/* Arrow Consensus → Needs Review */}
      <line x1='320' y1='710' x2='320' y2='748' stroke='currentColor' strokeWidth='1.5' opacity='0.5' markerEnd='url(#arrow)' />

      {/* Needs Review box */}
      <g>
        <rect
          x='180' y='750' width='280' height='140' rx='4'
          className='fill-white stroke-zinc-400 dark:fill-zinc-900 dark:stroke-zinc-600'
          strokeWidth='1.5'
        />
        <text x='320' y='786' textAnchor='middle' className='fill-current font-serif text-[20px]' fontStyle='italic'>Needs Review</text>
        <text x='320' y='816' textAnchor='middle' className='fill-current text-[15px]' opacity='0.8'>Office Manager reviews</text>
        <text x='320' y='840' textAnchor='middle' className='fill-current text-[15px]' opacity='0.8'>Matches + flagged rows</text>
        <text x='320' y='864' textAnchor='middle' className='fill-current text-[15px]' opacity='0.8'>Confidence + reasoning</text>
      </g>

      {/* Override loop — curved arrow going out right and back into Needs Review */}
      <path
        d='M 460 810 C 640 810, 640 870, 460 870'
        fill='none' stroke='currentColor' strokeWidth='1.2' strokeDasharray='4 3' opacity='0.55'
        markerEnd='url(#arrow)'
      />
      {/* Labels sit just above the loop's top curve so the dashed path does not cut through the text */}
      <text x='560' y='788' textAnchor='middle' className='fill-current font-serif text-[20px]' fontStyle='italic' opacity='0.8'>Override</text>
      <text x='560' y='806' textAnchor='middle' className='fill-current text-[12px]' opacity='0.6'>or Re-run</text>

      {/* Arrow Needs Review → Finalize */}
      <line x1='320' y1='890' x2='320' y2='928' stroke='currentColor' strokeWidth='1.5' opacity='0.5' markerEnd='url(#arrow)' />

      {/* Finalize (emerald) */}
      <g>
        <rect
          x='150' y='930' width='340' height='110' rx='4'
          className='fill-emerald-600 stroke-emerald-700 dark:fill-emerald-600 dark:stroke-emerald-500'
          strokeWidth='1.5'
        />
        <text x='320' y='968' textAnchor='middle' className='fill-white font-serif text-[20px]' fontStyle='italic'>Finalize batch</text>
        <text x='320' y='994' textAnchor='middle' className='fill-white text-[14px]' opacity='0.9'>Human action · checkbox gate</text>
        <text x='320' y='1016' textAnchor='middle' className='fill-white text-[14px]' opacity='0.9'>Locks batch · writes audit entry</text>
      </g>

      {/* Arrow Finalize → Invoices ready-to-pay */}
      <line x1='320' y1='1040' x2='320' y2='1078' stroke='currentColor' strokeWidth='1.5' opacity='0.5' markerEnd='url(#arrow)' />

      {/* Invoices ready-to-pay */}
      <g>
        <rect
          x='180' y='1080' width='280' height='100' rx='4'
          className='fill-white stroke-zinc-400 dark:fill-zinc-900 dark:stroke-zinc-600'
          strokeWidth='1.5'
        />
        <text x='320' y='1116' textAnchor='middle' className='fill-current font-serif text-[18px]' fontStyle='italic'>Invoices → ready-to-pay</text>
        <text x='320' y='1146' textAnchor='middle' className='fill-current text-[13px]' opacity='0.75'>Nexsyis AP status flipped</text>
      </g>

      {/* Split arrows to Sync and Check-run */}
      <line x1='320' y1='1180' x2='180' y2='1238' stroke='currentColor' strokeWidth='1.5' opacity='0.5' markerEnd='url(#arrow)' />
      <line x1='320' y1='1180' x2='460' y2='1238' stroke='currentColor' strokeWidth='1.5' opacity='0.5' markerEnd='url(#arrow)' />

      {/* Sync to Nexsyis (simulated) */}
      <g>
        <rect
          x='20' y='1240' width='260' height='150' rx='4'
          className='fill-white stroke-zinc-400 dark:fill-zinc-900 dark:stroke-zinc-600'
          strokeWidth='1.5' strokeDasharray='5 3'
        />
        <text x='150' y='1278' textAnchor='middle' className='fill-current font-serif text-[18px]' fontStyle='italic'>Sync to Nexsyis</text>
        <text x='150' y='1302' textAnchor='middle' className='fill-current text-[12px]' opacity='0.6'>(simulated today)</text>
        <text x='150' y='1328' textAnchor='middle' className='fill-current text-[13px]' opacity='0.8'>Lock statement</text>
        <text x='150' y='1348' textAnchor='middle' className='fill-current text-[13px]' opacity='0.8'>Post adjustments</text>
        <text x='150' y='1368' textAnchor='middle' className='fill-current text-[13px]' opacity='0.8'>Return transaction id</text>
      </g>

      {/* Check run (simulated) */}
      <g>
        <rect
          x='340' y='1240' width='280' height='150' rx='4'
          className='fill-white stroke-zinc-400 dark:fill-zinc-900 dark:stroke-zinc-600'
          strokeWidth='1.5' strokeDasharray='5 3'
        />
        <text x='480' y='1278' textAnchor='middle' className='fill-current font-serif text-[18px]' fontStyle='italic'>Start check run</text>
        <text x='480' y='1302' textAnchor='middle' className='fill-current text-[12px]' opacity='0.6'>(simulated today)</text>
        <text x='480' y='1328' textAnchor='middle' className='fill-current text-[13px]' opacity='0.8'>Hand off to</text>
        <text x='480' y='1348' textAnchor='middle' className='fill-current text-[13px]' opacity='0.8'>Payment Processing</text>
        <text x='480' y='1368' textAnchor='middle' className='fill-current text-[13px]' opacity='0.8'>ACH / check print</text>
      </g>

      {/* Un-finalize loop — curved arrow from right side of Finalize back up to Needs Review */}
      <path
        d='M 150 985 C 20 985, 20 820, 180 820'
        fill='none' stroke='currentColor' strokeWidth='1.2' strokeDasharray='4 3' opacity='0.5'
        markerEnd='url(#arrow)'
      />
      {/* Label sits to the left of the dashed loop, vertically centred in the gap between Needs Review and Finalize */}
      <text x='-25' y='912' textAnchor='middle' className='fill-current font-serif text-[20px]' fontStyle='italic' opacity='0.8'>Un-finalize</text>

      {/* Edit history — positioned to the right, clear of the Override / Re-run loop */}
      <rect
        x='690' y='790' width='180' height='120' rx='4'
        className='fill-zinc-100 stroke-zinc-300 dark:fill-zinc-900 dark:stroke-zinc-700'
        strokeWidth='1'
      />
      <text x='780' y='828' textAnchor='middle' className='fill-current font-serif text-[20px]' fontStyle='italic' opacity='0.9'>Edit history</text>
      <text x='780' y='860' textAnchor='middle' className='fill-current text-[13px]' opacity='0.7'>AI · overrides</text>
      <text x='780' y='882' textAnchor='middle' className='fill-current text-[13px]' opacity='0.7'>lifecycle events</text>

      {/* Feeder arrows — AI consensus, overrides, and finalize events all flow into edit history */}
      <path
        d='M 490 625 C 700 625, 780 700, 780 790'
        fill='none' stroke='currentColor' strokeWidth='1.2' strokeDasharray='4 3' opacity='0.5'
        markerEnd='url(#arrow)'
      />
      <path
        d='M 490 985 C 700 985, 780 950, 780 910'
        fill='none' stroke='currentColor' strokeWidth='0.8' strokeDasharray='3 3' opacity='0.35'
        markerEnd='url(#arrow)'
      />
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

function LifecycleRow({
  code,
  label,
  body,
  emerald,
  amber,
}: {
  code: string;
  label: string;
  body: string;
  emerald?: boolean;
  amber?: boolean;
}) {
  const pill = emerald
    ? 'bg-emerald-600 text-white'
    : amber
    ? 'bg-amber-500 text-white'
    : 'bg-zinc-200 text-on-surface dark:bg-zinc-800 dark:text-white';
  return (
    <li className='flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-zinc-100 py-2 first:border-t-0 dark:border-zinc-900'>
      <span className={'rounded-full px-2 py-0.5 font-mono text-[10px] font-medium ' + pill}>
        {code}
      </span>
      <span className='font-serif text-base text-on-surface dark:text-white'>{label}</span>
      <span className='text-xs text-on-surface-variant dark:text-neutral-400'>{body}</span>
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
