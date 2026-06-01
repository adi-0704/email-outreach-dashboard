"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export function SyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const res = await fetch('/api/gmail/sync');
      const data = await res.json();
      
      if (data.success) {
        // Refresh the current route to fetch new data from the server
        router.refresh();
      } else {
        alert(data.error || data.message || 'Failed to sync');
      }
    } catch (error) {
      console.error(error);
      alert('An error occurred during sync.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <button 
      onClick={handleSync}
      disabled={isSyncing}
      className={`px-4 py-2 rounded-full text-sm font-medium border flex items-center gap-2 transition-colors ${
        isSyncing 
          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 cursor-not-allowed' 
          : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
      }`}
    >
      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-blue-400' : 'text-gray-400'}`} />
      {isSyncing ? 'Syncing...' : 'Sync Now'}
    </button>
  );
}
