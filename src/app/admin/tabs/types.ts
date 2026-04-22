import type { Tables } from '@/libs/supabase/types';

export type Business = Tables<'aa_demo_businesses'>;
export type EditRequest = Tables<'aa_demo_edit_requests'>;
export type GeneratedAsset = Tables<'aa_demo_generated_assets'>;

export type CustomerWithEmail = {
  user_id: string;
  email: string;
  created_at: string;
  // Business fields — null if user has no business record yet
  business_id: string | null;
  business_name: string | null;
  industry: string | null;
  location_city: string | null;
  location_state: string | null;
  location_country: string | null;
  target_audience: string | null;
  services_products: string | null;
  website_features: string[] | null;
  status: string;
  is_prospect: boolean;
  // Payment fields — auto-updated by Stripe, not manually editable
  payment_status: string | null;
  subscription_plan: string | null;
  amount_paid: number | null;
  payment_paid_at: string | null;
};
export type EditRequestWithBusiness = EditRequest & { businessName: string; complexity?: string };
export interface DashboardStats {
  totalUsers: number;
  totalProspects: number;
  activeWebsites: number;
  pendingQueue: number;
  pendingEdits: number;
  monthlyRevenue: number;
  newUsersThisWeek: number;
}

export const getStatusBadge = (status: string | null): string => {
  if (!status) return 'bg-zinc-500/20 text-zinc-600 dark:text-zinc-400';
  const styles: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
    in_progress: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
    completed: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    generating: 'bg-purple-500/20 text-purple-700 dark:text-purple-400',
    active: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    paid: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    assets_generating: 'bg-purple-500/20 text-purple-700 dark:text-purple-400',
    assets_ready: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400',
    onboarding: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
    approved: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    rejected: 'bg-red-500/20 text-red-700 dark:text-red-400',
    no_business: 'bg-zinc-500/20 text-zinc-600 dark:text-zinc-400',
  };
  return styles[status] ?? 'bg-zinc-500/20 text-zinc-600 dark:text-zinc-400';
};

export const formatStatus = (status: string | null): string =>
  status ? status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Unknown';
