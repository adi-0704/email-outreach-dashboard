'use client';

import { useState } from 'react';
import { UserPlus, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  eventId: string;
  isAlreadyLead: boolean;
  leadEmail?: string | null;
}

export function MarkAsLeadButton({ eventId, isAlreadyLead, leadEmail }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'already' | 'error'>(
    isAlreadyLead ? 'already' : 'idle'
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [promotedEmail, setPromotedEmail] = useState<string | null>(leadEmail ?? null);

  async function handlePromote() {
    setState('loading');
    setErrorMsg(null);

    try {
      const res = await fetch('/api/leads/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? 'Something went wrong.');
        setState('error');
        return;
      }

      setPromotedEmail(data.lead?.email ?? null);
      setState(data.alreadyLead ? 'already' : 'done');
    } catch {
      setErrorMsg('Network error — please try again.');
      setState('error');
    }
  }

  if (state === 'already' || state === 'done') {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-medium">
        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          {state === 'done' ? 'Promoted to Lead' : 'Lead'}
          {promotedEmail && (
            <span className="text-emerald-300/70 ml-1">· {promotedEmail}</span>
          )}
        </span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {errorMsg}
        </div>
        <button
          onClick={handlePromote}
          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white text-xs transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handlePromote}
      disabled={state === 'loading'}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 hover:border-blue-500/40 text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {state === 'loading' ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <UserPlus className="w-3.5 h-3.5" />
      )}
      {state === 'loading' ? 'Promoting…' : 'Mark as Lead'}
    </button>
  );
}
