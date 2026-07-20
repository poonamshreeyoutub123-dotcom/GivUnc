'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Profile, Task, VerificationLog, SupportTicket, TicketMessage, TaskCompletion } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Users, Target, FileText, MessageSquare, Plus, Trash2, Edit2, Save, X, Send, CheckCircle2, Clock, AlertCircle, Zap, ArrowLeft } from 'lucide-react';
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

export default function AdminPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (profile && !profile.is_admin) router.push('/dashboard');
    }
  }, [loading, user, profile, router]);

  if (loading || !profile?.is_admin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <Shield className="mb-3 h-10 w-10 text-primary" />
        <h1 className="font-orbitron text-3xl font-bold">
          Admin <span className="text-gradient">Panel</span>
        </h1>
        <p className="mt-2 text-muted-foreground">Manage users, tasks, verification logs, and support tickets.</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-6 grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Tasks</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Logs</span>
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Tickets</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="tasks"><TasksTab /></TabsContent>
        <TabsContent value="logs"><LogsTab /></TabsContent>
        <TabsContent value="tickets"><TicketsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// USERS TAB
// ============================================================
function UsersTab() {
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editPts, setEditPts] = useState(0);

  const loadUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('pts', { ascending: false });
    setUsers((data as Profile[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSavePts = async () => {
    if (!editingUser) return;
    const { error } = await supabase
      .from('profiles')
      .update({ pts: editPts })
      .eq('id', editingUser.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Updated', description: `PTS updated for ${editingUser.display_name}` });
      setEditingUser(null);
      await loadUsers();
    }
  };

  const filtered = users.filter((u) =>
    u.display_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="h-32 animate-pulse rounded-xl bg-secondary" />;

  return (
    <div>
      <Input
        placeholder="Search users..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-md"
      />
      <div className="space-y-2">
        {filtered.map((u) => (
          <Card key={u.id} className="card-glow flex items-center gap-4 p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{u.display_name}</span>
                {u.is_admin && (
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                    <Shield className="mr-1 h-3 w-3" /> Admin
                  </Badge>
                )}
                {u.youtube_connected && (
                  <Badge variant="outline" className="text-xs border-red-500/30 text-red-500/70">
                    YouTube
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Rank: {u.rank} · Joined {new Date(u.created_at).toLocaleDateString()}
              </div>
            </div>
            <div className="text-right">
              <div className="font-orbitron text-xl font-bold text-primary">{u.pts}</div>
              <div className="text-xs text-muted-foreground">PTS</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingUser(u);
                setEditPts(u.pts);
              }}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          </Card>
        ))}
      </div>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit PTS — {editingUser?.display_name}</DialogTitle>
            <DialogDescription>Manually adjust this user's points balance.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pts">PTS Value</Label>
            <Input
              id="pts"
              type="number"
              value={editPts}
              onChange={(e) => setEditPts(parseInt(e.target.value) || 0)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={handleSavePts} className="gradient-primary text-background">
              <Save className="mr-1 h-4 w-4" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// TASKS TAB
// ============================================================
function TasksTab() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    task_type: 'custom',
    pts_value: 10,
    target_url: 'https://www.youtube.com/@UncopyedLockedHub',
    verification_method: 'manual',
    is_active: true,
    sort_order: 0,
  });

  const loadTasks = useCallback(async () => {
    const { data } = await supabase.from('tasks').select('*').order('sort_order');
    setTasks((data as Task[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleSave = async () => {
    if (editingTask) {
      const { error } = await supabase
        .from('tasks')
        .update(formData)
        .eq('id', editingTask.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Task updated' });
        setEditingTask(null);
        await loadTasks();
      }
    } else {
      const { error } = await supabase.from('tasks').insert(formData);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Task created' });
        setShowNew(false);
        await loadTasks();
      }
    }
  };

  const handleDelete = async (taskId: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Task deleted' });
      await loadTasks();
    }
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description,
      task_type: task.task_type,
      pts_value: task.pts_value,
      target_url: task.target_url,
      verification_method: task.verification_method,
      is_active: task.is_active,
      sort_order: task.sort_order,
    });
  };

  if (loading) return <div className="h-32 animate-pulse rounded-xl bg-secondary" />;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button
          onClick={() => {
            setShowNew(true);
            setEditingTask(null);
            setFormData({
              title: '',
              description: '',
              task_type: 'custom',
              pts_value: 10,
              target_url: 'https://www.youtube.com/@UncopyedLockedHub',
              verification_method: 'manual',
              is_active: true,
              sort_order: tasks.length + 1,
            });
          }}
          className="gradient-primary text-background"
        >
          <Plus className="mr-1 h-4 w-4" /> New Task
        </Button>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => (
          <Card key={task.id} className="card-glow flex items-center gap-4 p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{task.title}</span>
                {!task.is_active && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                )}
                <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                  <Zap className="mr-1 h-3 w-3" /> {task.pts_value} PTS
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Type: {task.task_type} · Verification: {task.verification_method}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => openEdit(task)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="border-destructive/30 text-destructive" onClick={() => handleDelete(task.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </Card>
        ))}
      </div>

      <Dialog open={!!editingTask || showNew} onOpenChange={(open) => { if (!open) { setEditingTask(null); setShowNew(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
            <DialogDescription>
              {editingTask ? 'Modify this task.' : 'Create a new task for users to complete.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="type">Task Type</Label>
                <select
                  id="type"
                  value={formData.task_type}
                  onChange={(e) => setFormData({ ...formData, task_type: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="subscribe">Subscribe</option>
                  <option value="like">Like</option>
                  <option value="comment">Comment</option>
                  <option value="watch">Watch</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pts">PTS Value</Label>
                <Input id="pts" type="number" value={formData.pts_value} onChange={(e) => setFormData({ ...formData, pts_value: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">Target URL</Label>
              <Input id="url" value={formData.target_url} onChange={(e) => setFormData({ ...formData, target_url: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="verification">Verification Method</Label>
                <select
                  id="verification"
                  value={formData.verification_method}
                  onChange={(e) => setFormData({ ...formData, verification_method: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="manual">Manual Review</option>
                  <option value="youtube_api">YouTube API (Auto)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort">Sort Order</Label>
                <Input id="sort" type="number" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              Active (visible to users)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingTask(null); setShowNew(false); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.title.trim()} className="gradient-primary text-background">
              <Save className="mr-1 h-4 w-4" /> {editingTask ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// LOGS TAB
// ============================================================
function LogsTab() {
  const [logs, setLogs] = useState<(VerificationLog & { profiles?: Pick<Profile, 'display_name'> })[]>([]);
  const [loading, setLoading] = useState(true);
  const [completions, setCompletions] = useState<Record<string, TaskCompletion[]>>({});
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: logData } = await supabase
        .from('verification_logs')
        .select('*, profiles!verification_logs_user_id_fkey(display_name)')
        .order('created_at', { ascending: false })
        .limit(100);
      setLogs(logData as any || []);
      setLoading(false);
    })();
  }, []);

  const loadUserCompletions = async (userId: string) => {
    const { data } = await supabase
      .from('task_completions')
      .select('*, tasks(title, pts_value)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setCompletions({ ...completions, [userId]: (data as TaskCompletion[]) || [] });
  };

  if (loading) return <div className="h-32 animate-pulse rounded-xl bg-secondary" />;

  return (
    <div className="space-y-2">
      {logs.length === 0 ? (
        <Card className="card-glow p-12 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No verification logs yet.</p>
        </Card>
      ) : (
        logs.map((log) => {
          const userName = (log as any).profiles?.display_name || 'Unknown';
          return (
            <Card key={log.id} className="card-glow p-3">
              <div className="flex items-center gap-3">
                <LogStatusIcon status={log.status} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{userName}</span>
                    <Badge variant="outline" className="text-xs">{log.action}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                    {log.details && ` · ${JSON.stringify(log.details)}`}
                  </div>
                </div>
              </div>
            </Card>
          );
        })
      )}

      {/* Pending completions for manual review */}
      <div className="mt-8">
        <h3 className="mb-4 font-orbitron text-lg font-bold">Pending Manual Reviews</h3>
        <PendingReviews />
      </div>
    </div>
  );
}

function PendingReviews() {
  const { toast } = useToast();
  const [pending, setPending] = useState<(TaskCompletion & { profiles?: Pick<Profile, 'display_name'>, tasks?: Pick<Task, 'title' | 'pts_value'> })[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPending = useCallback(async () => {
    const { data } = await supabase
      .from('task_completions')
      .select('*, profiles!task_completions_user_id_fkey(display_name), tasks(title, pts_value)')
      .eq('status', 'pending')
      .order('claimed_at', { ascending: false });
    setPending((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const handleApprove = async (completion: any) => {
    const { error: updateError } = await supabase
      .from('task_completions')
      .update({ status: 'verified', verified_at: new Date().toISOString() })
      .eq('id', completion.id);
    if (updateError) {
      toast({ title: 'Error', description: updateError.message, variant: 'destructive' });
      return;
    }

    // Add PTS to user
    const currentPts = await supabase.from('profiles').select('pts').eq('id', completion.user_id).maybeSingle();
    const newPts = (currentPts.data?.pts || 0) + (completion.tasks?.pts_value || 0);
    await supabase.from('profiles').update({ pts: newPts }).eq('id', completion.user_id);

    // Log
    await supabase.from('verification_logs').insert({
      user_id: completion.user_id,
      task_id: completion.task_id,
      action: 'verify',
      status: 'success',
      details: { method: 'manual_admin', pts_awarded: completion.tasks?.pts_value },
    });

    toast({ title: 'Approved!', description: `Awarded ${completion.tasks?.pts_value} PTS` });
    await loadPending();
  };

  const handleReject = async (completion: any) => {
    const { error } = await supabase
      .from('task_completions')
      .update({ status: 'rejected' })
      .eq('id', completion.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    await supabase.from('verification_logs').insert({
      user_id: completion.user_id,
      task_id: completion.task_id,
      action: 'reject',
      status: 'failed',
      details: { method: 'manual_admin' },
    });

    toast({ title: 'Rejected' });
    await loadPending();
  };

  if (loading) return <div className="h-20 animate-pulse rounded-xl bg-secondary" />;

  if (pending.length === 0) {
    return (
      <Card className="card-glow p-8 text-center">
        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-primary" />
        <p className="text-sm text-muted-foreground">No pending reviews. All caught up!</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {pending.map((c) => (
        <Card key={c.id} className="card-glow p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.profiles?.display_name || 'Unknown'}</span>
                <span className="text-sm text-muted-foreground">·</span>
                <span className="text-sm">{c.tasks?.title || 'Unknown task'}</span>
                <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                  {c.tasks?.pts_value || 0} PTS
                </Badge>
              </div>
              {c.verification_data?.submission && (
                <div className="mt-2 rounded-lg bg-secondary/50 p-2 text-sm text-muted-foreground">
                  {c.verification_data.submission}
                </div>
              )}
              <div className="mt-1 text-xs text-muted-foreground">
                Claimed {new Date(c.claimed_at).toLocaleString()}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleApprove(c)} className="gradient-primary text-background">
                <CheckCircle2 className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" className="border-destructive/30 text-destructive" onClick={() => handleReject(c)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// TICKETS TAB
// ============================================================
function TicketsTab() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<(SupportTicket & { profiles?: Pick<Profile, 'display_name'> })[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<(SupportTicket & { profiles?: Pick<Profile, 'display_name'> }) | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);

  const loadTickets = useCallback(async () => {
    const { data } = await supabase
      .from('support_tickets')
      .select('*, profiles!support_tickets_user_id_fkey(display_name)')
      .order('updated_at', { ascending: false });
    setTickets((data as any[]) || []);
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (ticketId: string) => {
    const { data } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    setMessages((data as TicketMessage[]) || []);
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (selectedTicket) loadMessages(selectedTicket.id);
  }, [selectedTicket, loadMessages]);

  const handleReply = async () => {
    if (!selectedTicket || !reply.trim()) return;
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    const { error } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: selectedTicket.id,
        sender_id: user.user.id,
        is_from_admin: true,
        message: reply,
      });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      // Update ticket status to in_progress
      await supabase
        .from('support_tickets')
        .update({ status: 'in_progress' })
        .eq('id', selectedTicket.id);
      setReply('');
      await loadMessages(selectedTicket.id);
      await loadTickets();
    }
  };

  const handleResolve = async () => {
    if (!selectedTicket) return;
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: 'resolved' })
      .eq('id', selectedTicket.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Ticket resolved' });
      setSelectedTicket(null);
      await loadTickets();
    }
  };

  if (loading) return <div className="h-32 animate-pulse rounded-xl bg-secondary" />;

  if (selectedTicket) {
    return (
      <div>
        <Button variant="ghost" className="mb-4" onClick={() => { setSelectedTicket(null); loadTickets(); }}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tickets
        </Button>
        <Card className="card-glow mb-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{selectedTicket.subject}</h2>
              <div className="text-sm text-muted-foreground">From: {selectedTicket.profiles?.display_name}</div>
            </div>
            <TicketStatusBadge status={selectedTicket.status} />
          </div>
        </Card>

        <div className="space-y-3 mb-4 max-h-[50vh] overflow-y-auto">
          {messages.map((msg) => (
            <div key={msg.id} className={cn('flex', msg.is_from_admin ? 'justify-start' : 'justify-end')}>
              <div className={cn(
                'max-w-[80%] rounded-2xl px-4 py-3',
                msg.is_from_admin ? 'bg-secondary text-foreground' : 'gradient-primary text-background'
              )}>
                <div className="mb-1 text-xs opacity-70">
                  {msg.is_from_admin ? 'You (Owner)' : 'User'} · {new Date(msg.created_at).toLocaleString()}
                </div>
                <div className="whitespace-pre-wrap">{msg.message}</div>
              </div>
            </div>
          ))}
        </div>

        {selectedTicket.status !== 'resolved' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Type your reply..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleReply())}
              />
              <Button onClick={handleReply} disabled={!reply.trim()} className="gradient-primary text-background">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleResolve}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Mark Resolved
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tickets.length === 0 ? (
        <Card className="card-glow p-12 text-center">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No support tickets.</p>
        </Card>
      ) : (
        tickets.map((ticket) => (
          <Card
            key={ticket.id}
            className="card-glow flex items-center justify-between p-4 cursor-pointer hover:border-primary/30 transition-all"
            onClick={() => setSelectedTicket(ticket)}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{ticket.subject}</span>
                <TicketStatusBadge status={ticket.status} />
              </div>
              <div className="text-xs text-muted-foreground">
                From: {ticket.profiles?.display_name || 'Unknown'} · {new Date(ticket.created_at).toLocaleDateString()}
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

// ============================================================
// SHARED COMPONENTS
// ============================================================
function LogStatusIcon({ status }: { status: string }) {
  if (status === 'success')
    return <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />;
  if (status === 'pending')
    return <Clock className="h-5 w-5 text-yellow-500 flex-shrink-0" />;
  return <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />;
}

function TicketStatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    open: { color: 'text-yellow-500 border-yellow-500/30', label: 'Open' },
    in_progress: { color: 'text-blue-500 border-blue-500/30', label: 'In Progress' },
    resolved: { color: 'text-primary border-primary/30', label: 'Resolved' },
  };
  const c = config[status] || config.open;
  return (
    <Badge variant="outline" className={cn('text-xs', c.color)}>
      {c.label}
    </Badge>
  );
}
