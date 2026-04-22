import { PropsWithChildren } from 'react';
import type { Metadata } from 'next';
import Script from 'next/script';
import { Montserrat, Montserrat_Alternates, Poppins, Newsreader } from 'next/font/google';
import { ThemeInitScript } from '@/components/theme-init-script';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/utils/cn';
import { Analytics } from '@vercel/analytics/react';

import '@/styles/globals.css';

export const dynamic = 'force-dynamic';

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  display: 'swap',
});

const montserratAlternates = Montserrat_Alternates({
  variable: '--font-montserrat-alternates',
  weight: ['500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
});

const poppins = Poppins({
  variable: '--font-poppins',
  weight: ['700'],
  style: ['italic'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
});

const newsreader = Newsreader({
  variable: '--font-newsreader',
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ardent Advisors AI',
  description: 'Get a free professional website, logo, and branding guide for your small business. We handle everything — you just pay for hosting.',
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === 'development' && (
          <Script
            src='//unpkg.com/react-grab/dist/index.global.js'
            crossOrigin='anonymous'
            strategy='lazyOnload'
          />
        )}
      </head>
      <body className={cn('font-sans antialiased', montserrat.variable, montserratAlternates.variable, poppins.variable, newsreader.variable)}>
        <ThemeInitScript />
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}

