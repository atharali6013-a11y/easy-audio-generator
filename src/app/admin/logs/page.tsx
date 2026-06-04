'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface DebugLog {
  id: string;
  userId?: string;
  timestamp: string;
  stage?: string;
  message: string;
  stack?: string;
  context?: any;
}

function LogsDashboard() {
  const searchParams = useSearchParams();
  const filterUserId = searchParams.get('userId');

  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [searchQuery, setSearchQuery] = useState(filterUserId || '');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/logs');
      if (!res.ok) {
        throw new Error(`Failed to fetch logs: ${res.status}`);
      }
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unknown error fetching logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const toggleExpandLog = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  // Filter logs based on search query
  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    return (
      log.message.toLowerCase().includes(q) ||
      (log.stage && log.stage.toLowerCase().includes(q)) ||
      (log.userId && log.userId.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 z-10 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold Outfit tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-300">
            Debug & Error Logs
          </h1>
          <p className="text-sm text-white/60 mt-1">
            Real-time monitoring of application issues and user feedback.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/admin/users"
            className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition text-sm font-semibold"
          >
            👥 Users Directory
          </Link>
          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition text-sm font-semibold flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-purple-500 border-white/20" />
                Refreshing...
              </>
            ) : (
              <>🔄 Refresh Logs</>
            )}
          </button>
        </div>
      </div>

      {/* Tab Navigation & Search bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        {/* Dashboard Tabs */}
        <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl w-full sm:w-auto">
          <button
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg transition shadow-md"
          >
            System Logs
          </button>
          <Link 
            href="/admin/users"
            className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white rounded-lg transition"
          >
            Users Directory
          </Link>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search logs, stage or user ID..."
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

      {isLoading && logs.length === 0 ? (
        <div className="flex flex-col justify-center items-center py-20 gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-purple-500 border-white/20" />
          <p className="text-white/60 text-sm">Loading debug logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-md">
          <span className="text-4xl">🎉</span>
          <p className="text-white/80 font-medium mt-2">No debug logs found.</p>
          <p className="text-white/40 text-xs mt-1">Staging environment is clean and bug-free!</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-purple-300 font-semibold">
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6">Stage</th>
                  <th className="py-4 px-6">Message</th>
                  <th className="py-4 px-6">User</th>
                  <th className="py-4 px-6">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const dateStr = new Date(log.timestamp).toLocaleString();
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => toggleExpandLog(log.id)}>
                        <td className="py-4 px-6 font-mono text-xs text-white/70 whitespace-nowrap">
                          {dateStr}
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className="px-2.5 py-1 text-xs rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium uppercase">
                            {log.stage || 'client'}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-medium text-white/90">
                          <div className="line-clamp-2 max-w-md">{log.message}</div>
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-white/60 whitespace-nowrap">
                          {log.userId?.slice(0, 15) || 'guest'}
                        </td>
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <button className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
                            {isExpanded ? '▼ Hide Details' : '▶ Show Details'}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-white/5 border-l-2 border-purple-500">
                          <td colSpan={5} className="py-6 px-8 space-y-4">
                            {log.stack && (
                              <div className="space-y-1">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300">Stack Trace</h4>
                                <pre className="p-4 rounded-xl bg-[#080512] text-xs font-mono text-red-400 overflow-x-auto max-h-60 overflow-y-auto leading-relaxed border border-red-500/10">
                                  {log.stack}
                                </pre>
                              </div>
                            )}

                            {log.context && (
                              <div className="space-y-1">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300">Context Details</h4>
                                <pre className="p-4 rounded-xl bg-[#080512] text-xs font-mono text-indigo-300 overflow-x-auto leading-relaxed border border-indigo-500/10">
                                  {JSON.stringify(log.context, null, 2)}
                                </pre>
                              </div>
                            )}

                            {!log.stack && !log.context && (
                              <p className="text-xs text-white/50 italic">No additional diagnostics stack or context available.</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminLogsPage() {
  return (
    <div className="min-h-screen bg-[#0f0a1e] text-white py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

      <Suspense fallback={
        <div className="flex flex-col justify-center items-center py-20 gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-purple-500 border-white/20" />
          <p className="text-white/60 text-sm">Initializing dashboard...</p>
        </div>
      }>
        <LogsDashboard />
      </Suspense>
    </div>
  );
}
