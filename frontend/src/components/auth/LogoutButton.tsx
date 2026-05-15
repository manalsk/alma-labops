'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="p-2 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
      aria-label="Sign out"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
      ) : (
        <LogOut className="w-4 h-4 text-slate-500" />
      )}
    </button>
  );
}
