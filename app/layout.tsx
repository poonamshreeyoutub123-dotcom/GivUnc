import './globals.css';
import type { Metadata } from 'next';
import { Inter, Orbitron } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { Navbar } from '@/components/navbar';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron', weight: ['400', '500', '600', '700', '800', '900'] });

export const metadata: Metadata = {
  title: 'GiveUnc — Earn PTS, Climb the Leaderboard',
  description: 'Complete tasks, earn points, and compete on the GiveUnc leaderboard. Powered by UncopyedLockedHub.',
  openGraph: {
    title: 'GiveUnc — Earn PTS, Climb the Leaderboard',
    description: 'Complete tasks, earn points, and compete on the GiveUnc leaderboard.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${orbitron.variable} font-sans`}>
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
          </div>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
