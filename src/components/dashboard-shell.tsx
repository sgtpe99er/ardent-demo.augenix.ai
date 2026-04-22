'use client';

import { ReactNode } from 'react';

import { cn } from '@/utils/cn';

interface DashboardShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  sidebarClassName?: string;
}

export function DashboardShell({ sidebar, children, contentClassName, sidebarClassName }: DashboardShellProps) {
  return (
    <div className='dash-contrast'>
      <div className='relative left-[calc(-50vw+50%)] w-screen'>
        <div className='mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-[1440px] lg:grid-cols-[260px_minmax(0,1fr)]'>
          <aside className={cn('hidden border-r border-zinc-200 bg-zinc-50 lg:block dark:border-zinc-800 dark:bg-zinc-950', sidebarClassName)}>
            <div className='sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto p-3 lg:p-4'>{sidebar}</div>
          </aside>
          <div className={cn('min-w-0 px-4 py-8 lg:px-8', contentClassName)}>{children}</div>
        </div>
      </div>
    </div>
  );
}
