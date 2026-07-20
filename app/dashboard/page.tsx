'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Target, Zap, TrendingUp, Star, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const RANK_TIERS = [
  { name: 'Rookie', min: 0, color: 'text-gray-400' },
  { name: 'Pro', min: 100, color: 'text-blue-400' },
  { name: 'Elite', min: 500, color: 'text-purple-400' },
  { name: 'Master', min: 1000, color: 'text-yellow-400' },
  { name: 'Legend', min: 2000, color: 'text-red-400' },
];

function getRankInfo(rank: string) {
  return RANK_TIERS.find(t => t.name === rank) || RANK_TIERS[0];
}

function getNextRank(pts: number) {
  return RANK_TIERS.find(t => t.min > pts);
}

export default function DashboardPage() {
  const profile = { display_name: 'Demo User', pts: 250, rank: 'Pro' };
  const totalUsers = 156;
  const verifiedCount = 3;
  const pendingCount = 1;

  const rankInfo = getRankInfo(profile.rank);
  const nextRank = getNextRank(profile.pts);
  const progressToNext = nextRank
    ? Math.min(100, ((profile.pts - (RANK_TIERS.find((t) => t.name === profile.rank)?.min || 0)) / (nextRank.min - (RANK_TIERS.find((t) => t.name === profile.rank)?.min || 0))) * 100)
    : 100;

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
                #5
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
              <Trophy className="h-6 w-6 text-primary" />
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
              <TrendingUp className="h-6 w-6 text-primary" />
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

        <Card className="card-glow p-12 text-center">
          <Target className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="mb-4 text-muted-foreground">📢 Demo Mode - To see real task activity, set up Supabase backend</p>
          <Link href="/tasks">
            <Button className="gradient-primary text-background">View Available Tasks</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
