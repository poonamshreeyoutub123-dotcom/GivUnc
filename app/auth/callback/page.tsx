'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errCode = params.get('error');
    const success = params.get('success');
    const next = params.get('next') || '/tasks';

    if (errCode) {
      const messages: Record<string, string> = {
        oauth_denied: 'You denied the YouTube connection. Please try again.',
        missing_params: 'The OAuth response was missing required parameters.',
        invalid_state: 'The OAuth state was invalid or expired. Please try again.',
        token_exchange_failed: 'Google rejected the authorization code. Please try again.',
        profile_update_failed: 'Failed to save your YouTube connection. Please try again.',
      };
      setError(messages[errCode] || `YouTube connection failed (${errCode}).`);
      return;
    }

    if (success) {
      router.replace(next);
      return;
    }

    router.replace(next);
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-destructive">{error}</p>
        <button
          onClick={() => router.push('/tasks')}
          className="mt-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
        >
          Back to Tasks
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
