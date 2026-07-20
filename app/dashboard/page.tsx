'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { LeaderboardEntry, Task, TaskCompletion, getRankInfo, getNextRank, RANK_TIERS } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Target, Zap, TrendingUp, Youtube, ArrowRight, CheckCircle2, Clock, XCircle, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [position, setPosition] = useState<number | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: taskData }, { data: completionData }] = await Promise.all([
        supabase.from('tasks').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('task_completions').select('*').eq('user_id', user.id),
      ]);
      setTasks(taskData as Task[] || []);
      setCompletions(completionData as TaskCompletion[] || []);

      const { data: lb } = await supabase.from('leaderboard_view').select('*');
      const entry = (lb as LeaderboardEntry[])?.find((e) => e.id === user.id);
      if (entry) setPosition(entry.position);
      setTotalUsers((lb as LeaderboardEntry[])?.length || 0);
    })();
  }, [user]);

  if (loading || !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const rankInfo = getRankInfo(profile.rank);
  const nextRank = getNextRank(profile.pts);
  const progressToNext = nextRank
    ? Math.min(100, ((profile.pts - (RANK_TIERS.find((t) => t.name === profile.rank)?.min || 0)) / (nextRank.min - (RANK_TIERS.find((t) => t.name === profile.rank)?.min || 0))) * 100)
    : 100;

  const verifiedCount = completions.filter((c) => c.status === 'verified').length;
  const pendingCount = completions.filter((c) => c.status === 'pending').length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="mb-8 font-orbitron text-3xl font-bold">
        Welcome back, <span className="text-gradient">{profile.display_name}</span>
      </h1>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="card-glow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Total PTS</div>
              <div className="font-orbitron text-3xl font-bold text-primary glow-text">{profile.pts}</div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Zap className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="card-glow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Leaderboard Rank</div>
              <div className="font-orbitron text-3xl font-bold">
                #{position || '—'}
                <span className="text-sm font-normal text-muted-foreground"> / {totalUsers}</span>
              </div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="card-glow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Tasks Verified</div>
              <div className="font-orbitron text-3xl font-bold">{verifiedCount}</div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="card-glow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Pending Review</div>
              <div className="font-orbitron text-3xl font-bold">{pendingCount}</div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Clock className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Card>
      </div>

      {/* Rank progress */}
      <Card className="card-glow mt-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg bg-secondary', rankInfo.color)}>
              <Star className="h-5 w-5" fill="currentColor" />
            </div>
            <div>
              <div className="text-lg font-semibold">{profile.rank}</div>
              <div className="text-sm text-muted-foreground">Current Rank</div>
            </div>
          </div>
          {nextRank && (
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Next: {nextRank.name}</div>
              <div className="text-sm font-medium">{nextRank.min - profile.pts} PTS to go</div>
            </div>
          )}
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full gradient-primary transition-all duration-500"
            style={{ width: `${progressToNext}%` }}
          />
        </div>
      </Card>

      {/* YouTube connection status */}
      <Card className="card-glow mt-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              profile.youtube_connected ? 'bg-red-500/10 text-red-500' : 'bg-secondary text-muted-foreground'
            )}>
              <Youtube className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold">YouTube Connection</div>
              <div className="text-sm text-muted-foreground">
                {profile.youtube_connected
                  ? `Connected${profile.youtube_channel_id ? ` · ${profile.youtube_channel_id}` : ''}`
                  : 'Not connected — required for subscribe/like task verification'}
              </div>
            </div>
          </div>
          {!profile.youtube_connected && (
            <Link href="/tasks">
              <Button variant="outline" className="border-primary/30 hover:border-primary/50">
                Connect
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </Card>

      {/* Recent task activity */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-orbitron text-xl font-bold">Your Task Activity</h2>
          <Link href="/tasks">
            <Button variant="ghost" className="text-primary">
              View All Tasks
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {completions.length === 0 ? (
          <Card className="card-glow p-12 text-center">
            <Target className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="mb-4 text-muted-foreground">You haven't claimed any tasks yet.</p>
            <Link href="/tasks">
              <Button className="gradient-primary text-background">Start Earning PTS</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {completions.slice(0, 5).map((completion) => {
              const task = tasks.find((t) => t.id === completion.task_id);
              if (!task) return null;
              return (
                <Card key={completion.id} className="card-glow flex items-center gap-4 p-4">
                  <StatusIcon status={completion.status} />
                  <div className="flex-1">
                    <div className="font-medium">{task.title}</div>
                    <div className="text-sm text-muted-foreground">
                      Claimed {new Date(completion.claimed_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-orbitron font-bold text-primary">+{task.pts_value}</div>
                    <div className="text-xs text-muted-foreground">PTS</div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'verified')
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <CheckCircle2 className="h-5 w-5 text-primary" />
      </div>
    );
  if (status === 'pending')
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
        <Clock className="h-5 w-5 text-yellow-500" />
      </div>
    );
  if (status === 'rejected' || status === 'revoked')
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
        <XCircle className="h-5 w-5 text-destructive" />
      </div>
    );
  return null;
}
