'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, Trophy, LayoutDashboard, Target, MessageSquare, Shield, LogOut, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const { user, profile, signOut, loading } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Home', icon: Zap },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  ];

  if (user) {
    navLinks.push(
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/tasks', label: 'Tasks', icon: Target },
      { href: '/support', label: 'Support', icon: MessageSquare },
    );
    if (profile?.is_admin) {
      navLinks.push({ href: '/admin', label: 'Admin', icon: Shield });
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg gradient-primary glow-primary transition-transform group-hover:scale-105">
            <Zap className="h-5 w-5 text-background" fill="currentColor" />
          </div>
          <span className="font-orbitron text-lg font-bold tracking-tight text-gradient">
            GiveUnc
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  active
                    ? 'bg-primary/10 text-primary glow-text'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="hidden items-center gap-3 md:flex">
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-secondary" />
          ) : user ? (
            <>
              {profile && (
                <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5">
                  <Trophy className="h-4 w-4 text-primary" />
                  <span className="font-orbitron text-sm font-bold text-primary">{profile.pts}</span>
                  <span className="text-xs text-muted-foreground">PTS</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="mr-1 h-4 w-4" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Log In</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="gradient-primary text-background font-semibold hover:opacity-90">Sign Up</Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="rounded-lg p-2 text-muted-foreground hover:bg-secondary md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border bg-background/95 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-4">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
            {!user && (
              <div className="mt-2 flex gap-2">
                <Link href="/login" className="flex-1" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" className="w-full">Log In</Button>
                </Link>
                <Link href="/signup" className="flex-1" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full gradient-primary text-background">Sign Up</Button>
                </Link>
              </div>
            )}
            {user && (
              <Button variant="ghost" onClick={signOut} className="mt-2 justify-start">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
