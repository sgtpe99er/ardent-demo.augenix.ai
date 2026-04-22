'use client';

import type { Business, DeployedWebsite } from '@/types/database';

interface OverviewContentProps {
  hasPlan: boolean;
  business: Business | null;
  deployedWebsite: DeployedWebsite | null;
  websiteGuideNeedsApproval: boolean;
  hostingEndDate: string | null;
  userEmail: string;
  selection: unknown;
  feedback: unknown[];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function OverviewContent({
  business,
  userEmail,
}: OverviewContentProps) {
  const displayName = business?.business_name || userEmail || 'there';
  const greeting = getGreeting();

  return (
    <div className='py-16 lg:py-24'>
      <p className='mb-6 font-sans text-xs uppercase tracking-[0.2em] text-[#45464d] dark:text-neutral-400'>
        {greeting}
      </p>
      <h1 className='font-serif text-4xl font-normal leading-[1.05] tracking-tight text-[#191c1e] dark:text-white lg:text-6xl'>
        <span className='italic'>Welcome,</span> {displayName}
      </h1>
      <p className='mt-8 max-w-xl text-sm leading-relaxed text-[#45464d] dark:text-neutral-400'>
        Your curated workspace. Compositions, decisions, and progress — all in one quiet, considered place.
      </p>
    </div>
  );
}
