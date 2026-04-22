import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

export async function getUser() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.from('aa_demo_users').select('*').single();

  if (error) {
    console.error(error);
  }

  return data;
}
