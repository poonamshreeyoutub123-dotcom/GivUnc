'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { SupportTicket, TicketMessage } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, Plus, ArrowLeft, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function SupportPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [reply, setReply] = useState('');
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  const loadTickets = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    setTickets((data as SupportTicket[]) || []);
  }, [user]);

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

  const handleCreateTicket = async () => {
    if (!user || !newTicketSubject.trim() || !newTicketMessage.trim()) return;
    setSending(true);
    try {
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          subject: newTicketSubject,
          status: 'open',
          priority: 'normal',
        })
        .select()
        .single();

      if (ticketError || !ticket) {
        toast({ title: 'Error', description: ticketError?.message || 'Failed to create ticket', variant: 'destructive' });
        setSending(false);
        return;
      }

      const { error: msgError } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticket.id,
          sender_id: user.id,
          is_from_admin: false,
          message: newTicketMessage,
        });

      if (msgError) {
        toast({ title: 'Error', description: msgError.message, variant: 'destructive' });
      } else {
        toast({ title: 'Ticket created', description: 'The owner will get back to you.' });
        setNewTicketSubject('');
        setNewTicketMessage('');
        setShowNewTicket(false);
        await loadTickets();
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Something went wrong.', variant: 'destructive' });
    }
    setSending(false);
  };

  const handleReply = async () => {
    if (!selectedTicket || !user || !reply.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: user.id,
          is_from_admin: false,
          message: reply,
        });

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        setReply('');
        await loadMessages(selectedTicket.id);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Something went wrong.', variant: 'destructive' });
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (selectedTicket) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => {
            setSelectedTicket(null);
            setMessages([]);
            loadTickets();
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tickets
        </Button>

        <Card className="card-glow mb-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{selectedTicket.subject}</h2>
            <TicketStatusBadge status={selectedTicket.status} />
          </div>
        </Card>

        <div className="space-y-3 mb-4 max-h-[50vh] overflow-y-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex',
                msg.is_from_admin ? 'justify-start' : 'justify-end'
              )}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-3',
                  msg.is_from_admin
                    ? 'bg-secondary text-foreground'
                    : 'gradient-primary text-background'
                )}
              >
                <div className="mb-1 text-xs opacity-70">
                  {msg.is_from_admin ? 'Owner' : 'You'} · {new Date(msg.created_at).toLocaleString()}
                </div>
                <div className="whitespace-pre-wrap">{msg.message}</div>
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">No messages yet.</p>
          )}
        </div>

        {selectedTicket.status !== 'resolved' && (
          <div className="flex gap-2">
            <Input
              placeholder="Type your reply..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleReply())}
            />
            <Button
              onClick={handleReply}
              disabled={sending || !reply.trim()}
              className="gradient-primary text-background"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <MessageSquare className="mb-3 h-10 w-10 text-primary" />
          <h1 className="font-orbitron text-3xl font-bold">
            <span className="text-gradient">Support</span>
          </h1>
          <p className="mt-2 text-muted-foreground">Message the channel owner directly.</p>
        </div>
        <Button
          onClick={() => setShowNewTicket(!showNewTicket)}
          className="gradient-primary text-background"
        >
          <Plus className="mr-1 h-4 w-4" />
          New Ticket
        </Button>
      </div>

      {showNewTicket && (
        <Card className="card-glow mb-6 p-5 animate-slide-up">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Brief description of your issue"
                value={newTicketSubject}
                onChange={(e) => setNewTicketSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Describe your issue or question..."
                value={newTicketMessage}
                onChange={(e) => setNewTicketMessage(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNewTicket(false)}>Cancel</Button>
              <Button
                onClick={handleCreateTicket}
                disabled={sending || !newTicketSubject.trim() || !newTicketMessage.trim()}
                className="gradient-primary text-background"
              >
                {sending ? 'Creating...' : 'Create Ticket'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {tickets.length === 0 ? (
        <Card className="card-glow p-12 text-center">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No support tickets yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
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
                  {new Date(ticket.created_at).toLocaleDateString()}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TicketStatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: any; color: string; label: string }> = {
    open: { icon: AlertCircle, color: 'text-yellow-500 border-yellow-500/30', label: 'Open' },
    in_progress: { icon: Clock, color: 'text-blue-500 border-blue-500/30', label: 'In Progress' },
    resolved: { icon: CheckCircle2, color: 'text-primary border-primary/30', label: 'Resolved' },
  };
  const c = config[status] || config.open;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={cn('text-xs', c.color)}>
      <Icon className="mr-1 h-3 w-3" />
      {c.label}
    </Badge>
  );
}
