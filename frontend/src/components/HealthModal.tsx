import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
  Server,
  ShieldCheck,
  X,
} from 'lucide-react';
import { fetchHealth } from '../api/health';

interface HealthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HealthModal: React.FC<HealthModalProps> = ({ isOpen, onClose }) => {
  const { data, error, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    enabled: isOpen,
    refetchInterval: isOpen ? 10000 : false,
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="health-modal-title"
      data-testid="health-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl shadow-black/80 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="health-modal-title"
                className="text-base font-bold text-white tracking-tight"
              >
                System Health
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Live connectivity &amp; service diagnostics
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-testid="health-modal-close"
            aria-label="Close System Health modal"
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Status / Offline Banner */}
        {isLoading ? (
          <div
            data-testid="status-loading"
            className="flex items-center gap-2 text-xs font-medium px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 animate-pulse"
          >
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400" />
            <span>Checking backend health...</span>
          </div>
        ) : isError ? (
          <div
            data-testid="offline-banner"
            className="glass-panel-danger rounded-xl p-4 flex items-start justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-rose-200">
                  Backend Unreachable
                </h3>
                <p className="text-xs text-rose-300/80 mt-1 leading-relaxed">
                  Unable to establish a connection with the Go Echo server at{' '}
                  <code className="px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-800 text-rose-200 font-mono text-[11px]">
                    /api/health
                  </code>
                  .
                </p>
                {error instanceof Error && (
                  <p className="text-[11px] font-mono text-rose-400/90 mt-1.5">
                    Error: {error.message}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="health-retry-button"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 transition-colors disabled:opacity-50 shrink-0"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
              />
              <span>Retry</span>
            </button>
          </div>
        ) : (
          <div
            data-testid="status-badge-healthy"
            className="flex items-center justify-between text-xs font-medium px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Backend Connected (v{data?.version})</span>
            </div>
            {data?.timestamp && (
              <span className="font-mono text-[11px] text-emerald-400/80">
                {new Date(data.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
        )}

        {/* 3 Connectivity Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Go Echo Backend */}
          <div className="glass-panel rounded-xl p-4 transition-all hover:border-slate-700/80">
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Server className="h-4 w-4" />
              </div>
              {data?.status === 'healthy' ? (
                <span className="inline-flex items-center text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                </span>
              ) : isError ? (
                <span className="inline-flex items-center text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                  Offline
                </span>
              ) : (
                <span className="inline-flex items-center text-[11px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  Checking
                </span>
              )}
            </div>
            <h3 className="text-xs font-semibold text-white">Go Echo Backend</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              REST endpoints on <span className="font-mono text-slate-300">:8080</span>.
            </p>
          </div>

          {/* Card 2: Cloud Firestore */}
          <div className="glass-panel rounded-xl p-4 transition-all hover:border-slate-700/80">
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Database className="h-4 w-4" />
              </div>
              <span className="inline-flex items-center text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Ready
              </span>
            </div>
            <h3 className="text-xs font-semibold text-white">Cloud Firestore</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Emulator on <span className="font-mono text-slate-300">:8085</span>.
            </p>
          </div>

          {/* Card 3: Firebase Auth */}
          <div className="glass-panel rounded-xl p-4 transition-all hover:border-slate-700/80">
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className="inline-flex items-center text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Ready
              </span>
            </div>
            <h3 className="text-xs font-semibold text-white">Firebase Auth</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Auth Emulator on <span className="font-mono text-slate-300">:9099</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
