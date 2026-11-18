import React, { useState } from 'react';
import { Activity, Layers, Loader2, LogOut } from 'lucide-react';
import { DailyBoard } from './components/board/DailyBoard';
import { CalendarWidget } from './components/calendar/CalendarWidget';
import { HealthModal } from './components/HealthModal';
import { LoginPage } from './components/auth/LoginPage';
import { useAuth } from './context/AuthContext';
import { DateProvider, useDateContext } from './context/DateContext';

export const AppContent: React.FC = () => {
  const { selectedDate, isHistorical } = useDateContext();
  const { logout } = useAuth();
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);

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
            </div>
          </div>

          <div className="flex items-center space-x-2.5 sm:space-x-3">
            {/* Top-Navigation Interactive Calendar Widget */}
            <CalendarWidget />

            {/* Logout Button */}
            <button
              type="button"
              onClick={() => logout()}
              data-testid="logout-button"
              aria-label="Log out"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-800 border border-slate-700/80 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        {/* Board Header & Title */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Daily Execution &amp; Ritual Platform
            </h1>
          </div>
        </section>

        {/* 4-Row Daily Execution Board */}
        <section>
          <DailyBoard date={selectedDate} isReadOnly={isHistorical} />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <p>DailyCheckIn • Scrum Execution Rituals</p>
          <button
            type="button"
            onClick={() => setIsHealthModalOpen(true)}
            data-testid="footer-health-link"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-indigo-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded px-2 py-1"
          >
            <Activity className="h-3.5 w-3.5" />
            <span>System Health</span>
          </button>
        </div>
      </footer>

      <HealthModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 bg-mesh-dark flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <DateProvider>
      <AppContent />
    </DateProvider>
  );
};

export default App;
