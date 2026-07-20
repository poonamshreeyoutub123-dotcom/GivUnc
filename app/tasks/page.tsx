'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, Zap, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEMO_TASKS = [
  {
    id: '1',
    title: 'Subscribe to Channel',
    description: 'Subscribe to UncopyedLockedHub YouTube channel',
    task_type: 'subscribe',
    pts_value: 100,
    verification_method: 'youtube_api',
    target_url: 'https://youtube.com/@uncopyedlockedhub',
  },
  {
    id: '2',
    title: 'Like Recent Video',
    description: 'Like the most recent video on the channel',
    task_type: 'like',
    pts_value: 50,
    verification_method: 'youtube_api',
    target_url: 'https://youtube.com/@uncopyedlockedhub/videos',
  },
  {
    id: '3',
    title: 'Leave a Comment',
    description: 'Leave a thoughtful comment on any video',
    task_type: 'comment',
    pts_value: 75,
    verification_method: 'manual',
    target_url: 'https://youtube.com/@uncopyedlockedhub/videos',
  },
  {
    id: '4',
    title: 'Watch Full Video',
    description: 'Watch a video all the way through',
    task_type: 'watch',
    pts_value: 25,
    verification_method: 'manual',
    target_url: 'https://youtube.com/@uncopyedlockedhub/videos',
  },
  {
    id: '5',
    title: 'Share with Friends',
    description: 'Share the channel with a friend',
    task_type: 'custom',
    pts_value: 50,
    verification_method: 'manual',
    target_url: null,
  },
];

function TaskTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    subscribe: 'border-red-500/30 text-red-500',
    like: 'border-blue-500/30 text-blue-500',
    comment: 'border-purple-500/30 text-purple-500',
    watch: 'border-cyan-500/30 text-cyan-500',
    custom: 'border-slate-500/30 text-slate-400',
  };
  return (
    <Badge variant="outline" className={cn('text-xs capitalize', colors[type] || colors.custom)}>
      {type}
    </Badge>
  );
}

function VerificationBadge({ method }: { method: string }) {
  if (method === 'youtube_api') {
    return (
      <Badge variant="outline" className="text-xs border-red-500/20 text-red-500/70">
        Auto-verify
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs border-yellow-500/20 text-yellow-500/70">
      Manual review
    </Badge>
  );
}

export default function TasksPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <Target className="mb-3 h-10 w-10 text-primary" />
        <h1 className="font-orbitron text-3xl font-bold">
          Available <span className="text-gradient">Tasks</span>
        </h1>
        <p className="mt-2 text-muted-foreground">Complete tasks to earn PTS. Some tasks require YouTube connection for auto-verification.</p>
      </div>

      {/* Tasks list */}
      <div className="space-y-4">
        {DEMO_TASKS.map((task) => (
          <Card key={task.id} className="card-glow p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{task.title}</h3>
                  <TaskTypeBadge type={task.task_type} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                <div className="mt-3 flex items-center gap-3">
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    <Zap className="mr-1 h-3 w-3" />
                    {task.pts_value} PTS
                  </Badge>
                  <VerificationBadge method={task.verification_method} />
                  {task.target_url && (
                    <Link
                      href={task.target_url}
                      target="_blank"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open task
                    </Link>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0">
                <Button className="gradient-primary text-background font-semibold" disabled>
                  <Zap className="mr-1 h-4 w-4" />
                  Claim
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="card-glow mt-8 p-6 border-yellow-500/20 bg-yellow-500/5">
        <p className="text-sm text-muted-foreground">
          📢 <strong>Demo Mode:</strong> This page shows demo tasks. To earn real PTS, you need to set up a Supabase backend with YouTube OAuth integration.
        </p>
      </Card>
    </div>
  );
}
