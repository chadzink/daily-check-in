import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Server, 
  Database, 
  ShieldCheck, 
  CalendarDays,
  Layers
} from 'lucide-react';
import { fetchHealth } from './api/health';
import { DailyBoard } from './components/board/DailyBoard';

export const App: React.FC = () => {
  const currentDate = new Date();
  const formattedDate = format(currentDate, 'EEEE, MMMM d, yyyy');
  const currentDateISO = format(currentDate, 'yyyy-MM-dd');

  const { data, error, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 10000,
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 bg-mesh-dark flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
                DailyCheckIn
              </span>
              <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Milestone 3
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-md border border-slate-700/50">
              <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
              <span>{formattedDate}</span>
            </div>

            {/* Health Status Pill */}
            {isLoading ? (
              <div 
                data-testid="status-loading"
                className="inline-flex items-center space-x-2 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 animate-pulse"
              >
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400" />
                <span>Connecting...</span>
              </div>
            ) : isError ? (
              <div 
                data-testid="status-badge-error"
                className="inline-flex items-center space-x-2 text-xs font-medium px-3 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300"
              >
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                <span>Backend Offline</span>
              </div>
            ) : (
              <div 
                data-testid="status-badge-healthy"
                className="inline-flex items-center space-x-2 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shadow-sm shadow-emerald-500/10"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-subtle" />
                <span>Backend Connected (v{data?.version})</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        
        {/* Offline Alert Banner */}
        {isError && (
          <div 
            data-testid="offline-banner"
            className="glass-panel-danger rounded-xl p-5 shadow-xl transition-all duration-300 animate-in fade-in"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-rose-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-rose-200">
                    Backend Unreachable
                  </h3>
                  <p className="text-xs text-rose-300/80 mt-1 max-w-2xl leading-relaxed">
                    Unable to establish a connection with the Go Echo server at <code className="px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-800 text-rose-200 font-mono text-[11px]">/api/health</code>. Ensure the backend is running on port 8080.
                  </p>
                  {error instanceof Error && (
                    <p className="text-[11px] font-mono text-rose-400/90 mt-2">
                      Error: {error.message}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="inline-flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                <span>Retry</span>
              </button>
            </div>
          </div>
        )}

        {/* Board Header & Title */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
          <div>
            <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-1.5">
              <Activity className="h-3.5 w-3.5 text-indigo-400" />
              <span>Milestone 3 • 4-Row Execution Board</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Daily Execution & Standup Ritual
            </h1>
          </div>
        </section>

        {/* 4-Row Daily Execution Board */}
        <section>
          <DailyBoard date={currentDateISO} />
        </section>

        {/* System Stack & Connectivity Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 border-t border-slate-800/60">
          {/* Card 1: Echo Backend */}
          <div className="glass-panel rounded-xl p-5 transition-all hover:border-slate-700/80">
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Server className="h-4 w-4" />
              </div>
              {data?.status === 'healthy' ? (
                <span className="inline-flex items-center text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center text-[11px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  Checking
                </span>
              )}
            </div>
            <h2 className="text-xs font-semibold text-white">Go Echo Backend</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              REST endpoints on <span className="font-mono text-slate-300">:8080</span>.
            </p>
          </div>

          {/* Card 2: Firestore Emulator */}
          <div className="glass-panel rounded-xl p-5 transition-all hover:border-slate-700/80">
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Database className="h-4 w-4" />
              </div>
              <span className="inline-flex items-center text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Ready
              </span>
            </div>
            <h2 className="text-xs font-semibold text-white">Cloud Firestore</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Emulator on <span className="font-mono text-slate-300">:8085</span>.
            </p>
          </div>

          {/* Card 3: Firebase Auth & UI */}
          <div className="glass-panel rounded-xl p-5 transition-all hover:border-slate-700/80">
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className="inline-flex items-center text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Ready
              </span>
            </div>
            <h2 className="text-xs font-semibold text-white">Auth & UI</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Emulator UI on <a href="http://localhost:4000" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">:4000</a>.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 bg-slate-950/80 text-center text-xs text-slate-500">
        <p>DailyCheckIn • Scrum Execution Rituals • Milestone 3: 4-Row Execution Board</p>
      </footer>
    </div>
  );
};

export default App;
