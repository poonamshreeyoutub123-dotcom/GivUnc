'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { LeaderboardEntry } from '@/lib/types';
import { Trophy, Zap, Target, Shield, ArrowRight, Youtube, TrendingUp, Users, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function HomePage() {
  const [topPlayers, setTopPlayers] = useState<LeaderboardEntry[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPts, setTotalPts] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: lb } = await supabase
        .from('leaderboard_view')
        .select('*')
        .limit(5);
      setTopPlayers((lb as LeaderboardEntry[]) || []);

      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      setTotalUsers(count || 0);

      const { data: ptsData } = await supabase
        .from('profiles')
        .select('pts');
      const sum = (ptsData || []).reduce((acc, p: any) => acc + (p.pts || 0), 0);
      setTotalPts(sum);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:py-36">
          <div className="flex flex-col items-center text-center">
            {/* Channel badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm text-primary animate-fade-in">
              <Youtube className="h-4 w-4" />
              <span className="font-medium">UncopyedLockedHub</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">Official Rewards Platform</span>
            </div>

            <h1 className="font-orbitron text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl animate-slide-up">
              <span className="text-gradient">GiveUnc</span>
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground sm:text-xl animate-slide-up" style={{ animationDelay: '0.1s' }}>
              Complete tasks. Earn PTS. Climb the leaderboard. The top earner gets rewarded by UncopyedLockedHub.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Link href="/signup">
                <Button size="lg" className="gradient-primary text-background font-semibold glow-primary hover:opacity-90">
                  <Zap className="mr-2 h-5 w-5" />
                  Start Earning PTS
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button size="lg" variant="outline" className="border-primary/30 hover:border-primary/50">
                  <Trophy className="mr-2 h-5 w-5" />
                  View Leaderboard
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <Card className="card-glow p-6 text-center">
              <Users className="mx-auto mb-2 h-6 w-6 text-primary" />
              <div className="font-orbitron text-3xl font-bold">
                {loading ? '—' : totalUsers.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Active Members</div>
            </Card>
            <Card className="card-glow p-6 text-center">
              <TrendingUp className="mx-auto mb-2 h-6 w-6 text-primary" />
              <div className="font-orbitron text-3xl font-bold text-primary">
                {loading ? '—' : totalPts.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total PTS Earned</div>
            </Card>
            <Card className="card-glow p-6 text-center">
              <Target className="mx-auto mb-2 h-6 w-6 text-primary" />
              <div className="font-orbitron text-3xl font-bold">5+</div>
              <div className="text-sm text-muted-foreground">Tasks Available</div>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="mb-12 text-center font-orbitron text-3xl font-bold">
          How It <span className="text-gradient">Works</span>
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="card-glow p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <span className="font-orbitron text-xl font-bold">1</span>
            </div>
            <h3 className="mb-2 text-xl font-semibold">Create Account</h3>
            <p className="text-muted-foreground">
              Sign up with email or Google. Get your profile and start at Rookie rank with 0 PTS.
            </p>
          </Card>
          <Card className="card-glow p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <span className="font-orbitron text-xl font-bold">2</span>
            </div>
            <h3 className="mb-2 text-xl font-semibold">Complete Tasks</h3>
            <p className="text-muted-foreground">
              Subscribe, like, comment, watch, and share. Connect your YouTube account for auto-verification of subscribe/like tasks.
            </p>
          </Card>
          <Card className="card-glow p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <span className="font-orbitron text-xl font-bold">3</span>
            </div>
            <h3 className="mb-2 text-xl font-semibold">Climb & Win</h3>
            <p className="text-muted-foreground">
              Earn PTS for each verified task. The top earner on the leaderboard gets rewarded manually by the channel owner.
            </p>
          </Card>
        </div>
      </section>

      {/* Leaderboard preview */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="font-orbitron text-3xl font-bold">
            Top <span className="text-gradient">Players</span>
          </h2>
          <Link href="/leaderboard">
            <Button variant="ghost" className="text-primary hover:text-primary">
              Full Leaderboard
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="space-y-3">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-secondary" />
            ))
          ) : topPlayers.length === 0 ? (
            <Card className="card-glow p-12 text-center">
              <Trophy className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">No players yet. Be the first to earn PTS!</p>
              <Link href="/signup" className="mt-4 inline-block">
                <Button className="gradient-primary text-background">Get Started</Button>
              </Link>
            </Card>
          ) : (
            topPlayers.map((player) => (
              <LeaderboardRow key={player.id} player={player} />
            ))
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <Card className="card-glow relative overflow-hidden p-10 text-center">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <div className="relative">
            <Sparkles className="mx-auto mb-4 h-10 w-10 text-primary" />
            <h2 className="mb-3 font-orbitron text-3xl font-bold">Ready to Start Earning?</h2>
            <p className="mb-6 text-muted-foreground">
              Join the GiveUnc community and compete for the top spot.
            </p>
            <Link href="/signup">
              <Button size="lg" className="gradient-primary text-background font-semibold glow-primary">
                Create Free Account
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}

function LeaderboardRow({ player }: { player: LeaderboardEntry }) {
  const isTop3 = player.position <= 3;
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <Card className={`card-glow flex items-center gap-4 p-4 ${isTop3 ? 'glow-border' : ''}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary font-orbitron text-lg font-bold">
        {isTop3 ? medals[player.position - 1] : player.position}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{player.display_name}</span>
          <Badge variant="outline" className="text-xs text-primary border-primary/30">{player.rank}</Badge>
        </div>
      </div>
      <div className="text-right">
        <div className="font-orbitron text-xl font-bold text-primary">{player.pts}</div>
        <div className="text-xs text-muted-foreground">PTS</div>
      </div>
    </Card>
  );
}
