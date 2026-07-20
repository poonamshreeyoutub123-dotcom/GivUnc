'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Trophy, Crown, Medal, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const RANK_TIERS = [
  { name: 'Rookie', min: 0, color: 'text-gray-400' },
  { name: 'Pro', min: 100, color: 'text-blue-400' },
  { name: 'Elite', min: 500, color: 'text-purple-400' },
  { name: 'Master', min: 1000, color: 'text-yellow-400' },
  { name: 'Legend', min: 2000, color: 'text-red-400' },
];

const DEMO_PLAYERS = [
  { id: '1', display_name: 'Player1', rank: 'Master', pts: 1500, position: 1 },
  { id: '2', display_name: 'Player2', rank: 'Elite', pts: 1200, position: 2 },
  { id: '3', display_name: 'Player3', rank: 'Pro', pts: 950, position: 3 },
  { id: '4', display_name: 'Player4', rank: 'Pro', pts: 750, position: 4 },
  { id: '5', display_name: 'Player5', rank: 'Pro', pts: 600, position: 5 },
];

function getRankInfo(rank: string) {
  return RANK_TIERS.find(t => t.name === rank) || RANK_TIERS[0];
}

export default function LeaderboardPage() {
  const [search, setSearch] = useState('');

  const filtered = DEMO_PLAYERS.filter((e) =>
    e.display_name.toLowerCase().includes(search.toLowerCase())
  );

  const top3 = filtered.slice(0, 3);
  const rest = filtered.slice(3);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8 text-center">
        <Trophy className="mx-auto mb-3 h-12 w-12 text-primary glow-text" />
        <h1 className="font-orbitron text-4xl font-bold">
          <span className="text-gradient">Leaderboard</span>
        </h1>
        <p className="mt-2 text-muted-foreground">Top earners competing for the reward</p>
      </div>

      {/* Search */}
      <div className="relative mb-8 max-w-md mx-auto">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="card-glow p-12 text-center">
          <Trophy className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No players found</p>
        </Card>
      ) : (
        <>
          {/* Top 3 podium */}
          {top3.length > 0 && (
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[1, 0, 2].map((idx) => {
                const player = top3[idx];
                if (!player) return <div key={idx} />;
                const isFirst = idx === 0;
                const rankInfo = getRankInfo(player.rank);
                return (
                  <Card
                    key={player.id}
                    className={cn(
                      'card-glow relative overflow-hidden p-6 text-center',
                      isFirst && 'sm:scale-110 glow-primary border-primary/30',
                      idx === 1 && 'sm:mt-4',
                      idx === 2 && 'sm:mt-8'
                    )}
                  >
                    {isFirst && (
                      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent" />
                    )}
                    <div className="relative">
                      <div className={cn(
                        'mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full',
                        isFirst ? 'bg-yellow-500/10' : idx === 1 ? 'bg-slate-300/10' : 'bg-amber-600/10'
                      )}>
                        {isFirst ? (
                          <Crown className="h-8 w-8 text-yellow-400" fill="currentColor" />
                        ) : (
                          <Medal className={cn('h-7 w-7', idx === 1 ? 'text-slate-300' : 'text-amber-600')} fill="currentColor" />
                        )}
                      </div>
                      <div className="font-orbitron text-2xl font-bold">
                        #{player.position}
                      </div>
                      <div className="mt-1 font-semibold text-lg">{player.display_name}</div>
                      <div className={cn('text-sm', rankInfo.color)}>{player.rank}</div>
                      <div className="mt-2 font-orbitron text-2xl font-bold text-primary">
                        {player.pts} <span className="text-sm font-normal text-muted-foreground">PTS</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Rest of leaderboard */}
          {rest.length > 0 && (
            <div className="space-y-2">
              {rest.map((player) => (
                <Card key={player.id} className="card-glow flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary font-orbitron text-sm font-bold text-muted-foreground">
                    {player.position}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{player.display_name}</span>
                      <span className={cn('text-xs', getRankInfo(player.rank).color)}>{player.rank}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-orbitron text-lg font-bold text-primary">{player.pts}</span>
                    <span className="ml-1 text-xs text-muted-foreground">PTS</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Rank tiers legend */}
      <div className="mt-12">
        <h2 className="mb-4 text-center font-orbitron text-xl font-bold">Rank Tiers</h2>
        <div className="flex flex-wrap justify-center gap-3">
          {RANK_TIERS.map((tier) => (
            <div
              key={tier.name}
              className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2"
            >
              <div className={cn('h-3 w-3 rounded-full', tier.color.replace('text-', 'bg-'))} />
              <span className="text-sm font-medium">{tier.name}</span>
              <span className="text-xs text-muted-foreground">{tier.min}+ PTS</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
