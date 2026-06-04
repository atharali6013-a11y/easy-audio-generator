'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

interface UserRecord {
  id: string;
  email: string;
  name: string;
  last_seen_at: string;
  created_at: string;
}

export default function AdminUsersPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const idToken = authUser ? await authUser.getIdToken() : 'guest-token-id';
      const res = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch users: ${res.status}`);
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unknown error fetching users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchUsers();
    }
  }, [authUser, authLoading]);

  // Filter users list based on query
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      u.id.toLowerCase().includes(q)
    );
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0f0a1e] flex flex-col items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-t-purple-500 border-white/20" />
        <p className="mt-4 text-purple-200 font-medium">Securing session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0a1e] text-white py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 z-10 relative">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold Outfit tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-300">
              Users Database
            </h1>
            <p className="text-sm text-white/60 mt-1">
              Monitor active users, join dates, and track logs.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/admin/logs"
              className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition text-sm font-semibold"
            >
              📋 System Logs
            </Link>
            
            <button
              onClick={fetchUsers}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition text-sm font-semibold flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-purple-500 border-white/20" />
                  Refreshing...
                </>
              ) : (
                <>🔄 Refresh Users</>
              )}
            </button>
          </div>
        </div>

        {/* Tab Navigation & Search bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          {/* Dashboard Tabs */}
          <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl w-full sm:w-auto">
            <Link 
              href="/admin/logs"
              className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white rounded-lg transition"
            >
              System Logs
            </Link>
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg transition shadow-md"
            >
              Users Directory
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Search by name, email or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-purple-500 text-sm transition"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-lg">
              🔍
            </span>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
            ⚠️ <strong>Error:</strong> {error}
          </div>
        )}

        {/* Users Table */}
        {isLoading && users.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-20 gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-purple-500 border-white/20" />
            <p className="text-white/60 text-sm">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-md">
            <span className="text-4xl">👥</span>
            <p className="text-white/80 font-medium mt-2">No users match your search.</p>
            <p className="text-white/40 text-xs mt-1">Try refining your search query.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-purple-300 font-semibold">
                    <th className="py-4 px-6">Name</th>
                    <th className="py-4 px-6">Email Address</th>
                    <th className="py-4 px-6">Last Active</th>
                    <th className="py-4 px-6">Registered On</th>
                    <th className="py-4 px-6 text-center">Troubleshooting</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredUsers.map((u) => {
                    const lastSeen = u.last_seen_at ? new Date(u.last_seen_at).toLocaleString() : 'Never';
                    const registered = u.created_at ? new Date(u.created_at).toLocaleString() : 'Unknown';
                    return (
                      <tr key={u.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6 font-semibold text-white/95 whitespace-nowrap">
                          {u.name || 'Anonymous User'}
                        </td>
                        <td className="py-4 px-6 text-white/80">
                          {u.email}
                        </td>
                        <td className="py-4 px-6 text-purple-200 font-medium whitespace-nowrap text-xs">
                          {lastSeen}
                        </td>
                        <td className="py-4 px-6 text-white/60 whitespace-nowrap text-xs">
                          {registered}
                        </td>
                        <td className="py-4 px-6 text-center whitespace-nowrap">
                          <Link 
                            href={`/admin/logs?userId=${u.id}`}
                            className="px-3.5 py-1.5 rounded-lg text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 font-bold transition"
                          >
                            🔍 Inspect Logs
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
