'use client';

import { PropsWithChildren, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IoGlobe,
  IoMenu,
  IoGridOutline,
  IoLogOutOutline,
} from 'react-icons/io5';

import { signOut } from '@/app/(auth)/auth-actions';
import { AccountMenu } from '@/components/account-menu';
import { DashboardShell } from '@/components/dashboard-shell';
import { useThemePreference, type ThemePreference } from '@/components/theme-selector';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/utils/cn';

interface DashboardLayoutClientProps extends PropsWithChildren {
  businessName: string | null;
  userEmail: string;
  /** Set when an admin is viewing this dashboard as another user. */
  impersonatingAdminEmail?: string;
}

export function DashboardLayoutClient({ children, businessName, userEmail, impersonatingAdminEmail }: DashboardLayoutClientProps) {
  const pathname = usePathname();
  const { preference, setPreference } = useThemePreference();
  const { toast } = useToast();

  const handleLogout = async () => {
    const response = await signOut();
    if (response?.error) {
      toast({ variant: 'destructive', description: 'Error logging out. Please try again.' });
    }
  };

  const sidebarItemClass = (active: boolean) =>
    cn(
      'flex w-full items-center gap-3 py-2.5 pl-6 pr-4 text-left text-sm font-medium transition-colors',
      active
        ? 'bg-surface-container-low text-on-surface dark:bg-zinc-900 dark:text-white'
        : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface dark:text-neutral-400 dark:hover:bg-zinc-900 dark:hover:text-white'
    );

  const sidebar = (
    <nav className='-mx-3 flex flex-col gap-1 lg:-mx-4'>
      <Link href='/dashboard' className={sidebarItemClass(pathname === '/dashboard')}>
        <IoGlobe className='h-4 w-4 shrink-0' aria-hidden='true' />
        <span>Dashboard</span>
      </Link>
    </nav>
  );

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const header = (
    <div className='sticky top-0 z-50'>
      <div
        className='absolute inset-0 bg-surface/80 backdrop-blur-md dark:bg-black/80'
        style={{ left: 'calc(-50vw + 50%)', width: '100vw' }}
      />
      <div className='relative'>
        <div className='pointer-events-none absolute inset-y-0 left-[260px] right-0 hidden items-center justify-center lg:flex'>
          <span id='dashboard-header-context' className='font-serif text-sm italic text-on-surface-variant dark:text-neutral-300'></span>
        </div>
        <div className='flex h-16 items-center justify-between'>
          <div className='flex items-center gap-4'>
            <Link href='/' className='flex-shrink-0'>
              <Image
                src='/client-logo.png'
                alt='Ardent'
                width={140}
                height={36}
                priority
                className='h-9 w-auto object-contain'
              />
            </Link>
          </div>
          <div className='flex items-center gap-2 pr-4 lg:pr-8'>
            <div className='hidden lg:block'>
              <AccountMenu signOut={signOut} businessName={businessName} userEmail={userEmail} />
            </div>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger className='text-black dark:text-white lg:hidden'>
                <IoMenu size={24} />
              </SheetTrigger>
              <SheetContent side='right' className='w-[280px] border-0 bg-surface p-6 dark:bg-zinc-950'>
                <SheetTitle className='sr-only'>Dashboard Menu</SheetTitle>
                <nav className='flex flex-col gap-1 pt-10'>
                  <SheetClose asChild>
                    <Link href='/dashboard' className={sidebarItemClass(pathname === '/dashboard')}>
                      <IoGlobe className='h-4 w-4 shrink-0' aria-hidden='true' />
                      <span>Dashboard</span>
                    </Link>
                  </SheetClose>
                </nav>
                <div className='mt-8 pt-6'>
                  <p className='mb-3 px-3 font-serif text-xs italic tracking-wide text-on-surface-variant dark:text-neutral-400'>Account</p>
                  {(businessName || userEmail) && (
                    <div className='mb-3 px-3'>
                      {businessName && <div className='text-sm font-medium text-on-surface dark:text-white'>{businessName}</div>}
                      {userEmail && <div className='text-xs text-on-surface-variant dark:text-neutral-500'>{userEmail}</div>}
                    </div>
                  )}
                  <SheetClose asChild>
                    <Link href='/dashboard' className={sidebarItemClass(false)}>
                      <IoGridOutline className='h-4 w-4 shrink-0' />
                      <span>Dashboard</span>
                    </Link>
                  </SheetClose>
                  <button
                    onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                    className={sidebarItemClass(false)}
                  >
                    <IoLogOutOutline className='h-4 w-4 shrink-0' />
                    <span>Log Out</span>
                  </button>
                  <p className='mt-6 px-3 font-serif text-xs italic tracking-wide text-on-surface-variant dark:text-neutral-400'>Appearance</p>
                  <div className='mt-2 flex gap-1 px-3'>
                    {(['dark', 'light', 'system'] as ThemePreference[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setPreference(t)}
                        className={cn(
                          'rounded-sm px-3 py-1.5 text-xs font-medium transition-colors',
                          preference === t
                            ? 'bg-on-surface text-white dark:bg-white dark:text-on-surface'
                            : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface dark:text-neutral-400 dark:hover:bg-zinc-900 dark:hover:text-white'
                        )}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </div>
  );

  const impersonationBanner = impersonatingAdminEmail ? (
    <div className='flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-black'>
      <span>
        Viewing as <strong>{userEmail}</strong> — you are logged in as{' '}
        <strong>{impersonatingAdminEmail}</strong>
      </span>
      <form action='/api/admin/exit-impersonation' method='POST'>
        <button
          type='submit'
          className='rounded-sm bg-black/20 px-3 py-0.5 text-xs font-semibold hover:bg-black/30 transition-colors'
        >
          Exit
        </button>
      </form>
    </div>
  ) : null;

  return (
    <div className='min-h-screen bg-surface dark:bg-black'>
      {impersonationBanner}
      {header}
      <DashboardShell
        sidebar={sidebar}
        sidebarClassName='hidden border-0 bg-surface lg:block dark:bg-zinc-950'
      >
        {children}
      </DashboardShell>
    </div>
  );
}
