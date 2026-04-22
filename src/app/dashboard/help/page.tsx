import { redirect } from 'next/navigation';

import { getSession } from '@/features/account/controllers/get-session';

import { HelpContent } from './_components/help-content';

export default async function HelpPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return <HelpContent />;
}
