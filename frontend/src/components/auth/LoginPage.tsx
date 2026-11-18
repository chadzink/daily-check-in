import React, { useState } from 'react';
import { AlertCircle, Layers, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLocalDev =
    import.meta.env.DEV ||
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to sign in. Please check your credentials.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('demo@dailycheckin.com');
    setPassword('Password123!');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 bg-mesh-dark flex flex-col items-center justify-center p-4 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-md bg-slate-900/70 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/60 flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Layers className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            DailyCheckIn
          </h1>
          <p className="text-xs text-slate-400">
            Sign in to access your daily execution board
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            data-testid="login-error"
            className="glass-panel-danger rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-rose-200"
          >
            <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Sign-In Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="demo@dailycheckin.com"
              data-testid="login-email-input"
              className="w-full bg-slate-950/80 text-slate-100 text-sm rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/80 placeholder:text-slate-600 transition-all"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              data-testid="login-password-input"
              className="w-full bg-slate-950/80 text-slate-100 text-sm rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/80 placeholder:text-slate-600 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="login-submit-button"
            className="mt-1 w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
          </button>
        </form>

        {/* Local Emulator Demo Hint */}
        {isLocalDev && (
          <div
            data-testid="login-demo-hint"
            className="rounded-xl bg-slate-950/60 border border-slate-800/80 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-slate-400"
          >
            <span className="font-mono text-[11px] text-slate-300 truncate">
              Demo: demo@dailycheckin.com / Password123!
            </span>
            <button
              type="button"
              onClick={handleFillDemo}
              data-testid="login-fill-demo"
              className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 shrink-0"
            >
              Fill
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
