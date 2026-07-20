export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  pts: number;
  rank: string;
  is_admin: boolean;
  youtube_connected: boolean;
  youtube_channel_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  task_type: string;
  pts_value: number;
  target_url: string;
  verification_method: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TaskCompletion {
  id: string;
  user_id: string;
  task_id: string;
  status: string;
  verification_data: any;
  claimed_at: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerificationLog {
  id: string;
  user_id: string;
  task_id: string | null;
  action: string;
  status: string;
  details: any;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  is_from_admin: boolean;
  message: string;
  created_at: string;
}

export interface LeaderboardEntry {
  id: string;
  display_name: string;
  avatar_url: string | null;
  pts: number;
  rank: string;
  position: number;
}

export const RANK_TIERS = [
  { name: 'Rookie', min: 0, color: 'text-slate-400', glow: 'shadow-slate-500/20' },
  { name: 'Bronze', min: 100, color: 'text-amber-600', glow: 'shadow-amber-600/30' },
  { name: 'Silver', min: 300, color: 'text-slate-200', glow: 'shadow-slate-300/30' },
  { name: 'Gold', min: 600, color: 'text-yellow-400', glow: 'shadow-yellow-400/40' },
  { name: 'Platinum', min: 1000, color: 'text-cyan-300', glow: 'shadow-cyan-400/40' },
  { name: 'Diamond', min: 2000, color: 'text-sky-300', glow: 'shadow-sky-400/50' },
  { name: 'Legend', min: 5000, color: 'text-emerald-300', glow: 'shadow-emerald-400/50' },
];

export function getRankForPts(pts: number): string {
  let rank = 'Rookie';
  for (const tier of RANK_TIERS) {
    if (pts >= tier.min) rank = tier.name;
  }
  return rank;
}

export function getRankInfo(rankName: string) {
  return RANK_TIERS.find((t) => t.name === rankName) || RANK_TIERS[0];
}

export function getNextRank(pts: number) {
  for (const tier of RANK_TIERS) {
    if (pts < tier.min) return tier;
  }
  return null;
}
