import { redirect } from 'next/navigation';

import { getSession } from '@/features/account/controllers/get-session';

import { signInWithPassword } from '../(auth)/auth-actions';
import { AuthUI } from '../(auth)/auth-ui';

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className='flex min-h-screen items-start justify-center p-6 pt-48'>
      <AuthUI signInWithPassword={signInWithPassword} />
    </div>
  );
}
