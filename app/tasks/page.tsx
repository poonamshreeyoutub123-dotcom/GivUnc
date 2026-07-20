'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Task, TaskCompletion } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Target, Zap, CheckCircle2, Clock, XCircle, Youtube, ExternalLink, AlertCircle, RefreshCw, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export default function TasksPage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<Record<string, TaskCompletion>>({});
  const [claiming, setClaiming] = useState<string | null>(null);
  const [submitModal, setSubmitModal] = useState<Task | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [{ data: taskData }, { data: completionData }] = await Promise.all([
      supabase.from('tasks').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('task_completions').select('*').eq('user_id', user.id),
    ]);
    setTasks(taskData as Task[] || []);
    const compMap: Record<string, TaskCompletion> = {};
    (completionData as TaskCompletion[] || []).forEach((c) => {
      compMap[c.task_id] = c;
    });
    setCompletions(compMap);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClaim = async (task: Task) => {
    if (!user) return;

    // If task requires YouTube API verification, check connection
    if (task.verification_method === 'youtube_api' && !profile?.youtube_connected) {
      toast({
        title: 'YouTube connection required',
        description: 'This task requires connecting your YouTube account for verification.',
        variant: 'destructive',
      });
      return;
    }

    // If manual verification, open submission dialog
    if (task.verification_method === 'manual') {
      setSubmitModal(task);
      setSubmissionText('');
      return;
    }

    // For youtube_api tasks, claim and then verify via edge function
    setClaiming(task.id);
    try {
      const { error } = await supabase
        .from('task_completions')
        .insert({
          user_id: user.id,
          task_id: task.id,
          status: 'pending',
        });

      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Already claimed', description: 'You have already claimed this task.', variant: 'destructive' });
        } else {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
        setClaiming(null);
        return;
      }

      // Try to verify via edge function
      const response = await fetch(`${SUPABASE_URL}/functions/v1/verify-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ taskId: task.id, userId: user.id }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.verified) {
          toast({
            title: 'Task verified!',
            description: `You earned ${task.pts_value} PTS!`,
          });
        } else {
          toast({
            title: 'Verification pending',
            description: result.message || 'Could not verify yet. We will re-check automatically.',
          });
        }
      } else {
        toast({
          title: 'Claimed — pending verification',
          description: 'Your task has been claimed and will be verified.',
        });
      }

      await loadData();
      await refreshProfile();
    } catch (err) {
      toast({ title: 'Error', description: 'Something went wrong.', variant: 'destructive' });
    }
    setClaiming(null);
  };

  const handleSubmitManual = async () => {
    if (!submitModal || !user) return;
    setClaiming(submitModal.id);
    try {
      const { error } = await supabase
        .from('task_completions')
        .insert({
          user_id: user.id,
          task_id: submitModal.id,
          status: 'pending',
          verification_data: { submission: submissionText },
        });

      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Already claimed', description: 'You have already claimed this task.', variant: 'destructive' });
        } else {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
      } else {
        toast({
          title: 'Task submitted!',
          description: 'Your submission is pending manual review by the owner.',
        });
        setSubmitModal(null);
        setSubmissionText('');
        await loadData();
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Something went wrong.', variant: 'destructive' });
    }
    setClaiming(null);
  };

  const handleConnectYouTube = async () => {
    if (!user) return;
    setConnecting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        toast({ title: 'Session expired', description: 'Please sign in again.', variant: 'destructive' });
        setConnecting(false);
        return;
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/youtube-oauth/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ next: '/tasks' }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: 'Connection failed', description: err?.error || 'Could not start OAuth flow.', variant: 'destructive' });
        setConnecting(false);
        return;
      }

      const { url: oauthUrl } = await res.json();
      if (oauthUrl) {
        window.location.href = oauthUrl;
      } else {
        toast({ title: 'Connection failed', description: 'No OAuth URL returned.', variant: 'destructive' });
        setConnecting(false);
      }
    } catch (err) {
      toast({ title: 'Connection failed', description: 'Something went wrong.', variant: 'destructive' });
      setConnecting(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <Target className="mb-3 h-10 w-10 text-primary" />
        <h1 className="font-orbitron text-3xl font-bold">
          Available <span className="text-gradient">Tasks</span>
        </h1>
        <p className="mt-2 text-muted-foreground">Complete tasks to earn PTS. Some require YouTube connection for auto-verification.</p>
      </div>

      {/* YouTube connection banner */}
      {!profile.youtube_connected && (
        <Card className="card-glow mb-6 p-5 border-red-500/20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                <Youtube className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <div className="font-semibold">Connect your YouTube account</div>
                <div className="text-sm text-muted-foreground">
                  Required for subscribe/like task verification. Google OAuth is used — we only check subscription/like status, nothing else.
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              className="border-red-500/30 text-red-500 hover:border-red-500/50 hover:text-red-500"
              onClick={handleConnectYouTube}
              disabled={connecting}
            >
              {connecting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4" />}
              Connect
            </Button>
          </div>
        </Card>
      )}

      {/* Tasks list */}
      <div className="space-y-4">
        {tasks.map((task) => {
          const completion = completions[task.id];
          return (
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
                  {completion ? (
                    <CompletionStatus status={completion.status} />
                  ) : (
                    <Button
                      onClick={() => handleClaim(task)}
                      disabled={claiming === task.id}
                      className="gradient-primary text-background font-semibold"
                    >
                      {claiming === task.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Zap className="mr-1 h-4 w-4" />
                          Claim
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {completion?.status === 'rejected' && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/5 p-2 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Your submission was rejected. You can try again.
                </div>
              )}

              {completion?.status === 'revoked' && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/5 p-2 text-xs text-destructive">
                  <RotateCcw className="h-4 w-4" />
                  Points revoked — we detected you unsubscribed. Re-subscribe and claim again to re-earn.
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Manual submission dialog */}
      <Dialog open={!!submitModal} onOpenChange={(open) => !open && setSubmitModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{submitModal?.title}</DialogTitle>
            <DialogDescription>
              Submit proof of completion for manual review. Include a link to your comment, post, or other evidence.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="submission">Your submission</Label>
            <Textarea
              id="submission"
              placeholder="Paste a link to your comment, post, or describe what you did..."
              value={submissionText}
              onChange={(e) => setSubmissionText(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitModal(null)}>Cancel</Button>
            <Button
              onClick={handleSubmitManual}
              disabled={claiming === submitModal?.id || !submissionText.trim()}
              className="gradient-primary text-background"
            >
              {claiming === submitModal?.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Submit for Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
        <Youtube className="mr-1 h-3 w-3" />
        Auto-verify
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs border-yellow-500/20 text-yellow-500/70">
      <Clock className="mr-1 h-3 w-3" />
      Manual review
    </Badge>
  );
}

function CompletionStatus({ status }: { status: string }) {
  if (status === 'verified')
    return (
      <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-primary">
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-medium">Verified</span>
      </div>
    );
  if (status === 'pending')
    return (
      <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 px-4 py-2 text-yellow-500">
        <Clock className="h-5 w-5" />
        <span className="font-medium">Pending</span>
      </div>
    );
  if (status === 'rejected')
    return (
      <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-2 text-destructive">
        <XCircle className="h-5 w-5" />
        <span className="font-medium">Rejected</span>
      </div>
    );
  if (status === 'revoked')
    return (
      <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-2 text-destructive">
        <RotateCcw className="h-5 w-5" />
        <span className="font-medium">Revoked</span>
      </div>
    );
  return null;
}
