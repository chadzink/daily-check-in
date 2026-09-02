import React from 'react';
import { format } from 'date-fns';
import { CheckCircle2, Calendar, Award } from 'lucide-react';
import { DayTaskWithDetails } from '../../types/domain';

interface Step1YesterdayReviewProps {
  previousDate?: string;
  yesterdayTasks: DayTaskWithDetails[];
}

export const Step1YesterdayReview: React.FC<Step1YesterdayReviewProps> = ({
  previousDate,
  yesterdayTasks,
}) => {
  const formattedPrevDate = previousDate
    ? (() => {
        try {
          return format(new Date(previousDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy');
        } catch {
          return previousDate;
        }
      })()
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
            <Award className="h-4 w-4 text-emerald-400" />
            <span>Yesterday&apos;s Accomplishments</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Celebrate what you finished on your last active workday before planning today.
          </p>
        </div>
        {formattedPrevDate && (
          <div className="flex items-center space-x-1.5 text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
            <Calendar className="h-3 w-3 text-slate-400" />
            <span>{formattedPrevDate}</span>
          </div>
        )}
      </div>

      {yesterdayTasks.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800/60 text-slate-400">
          <CheckCircle2 className="h-8 w-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-300">
            No completed tasks recorded on previous session.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Every day is a fresh opportunity to ship impactful work!
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {yesterdayTasks.map((task) => (
            <div
              key={task.day_task_id || task.task_id}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/30 transition-all"
            >
              <div className="flex items-center space-x-3">
                <div className="h-6 w-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-medium text-slate-200 line-through decoration-slate-500">
                    {task.title}
                  </h4>
                  {task.description && (
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-md">
                      {task.description}
                    </p>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-emerald-400/90 font-medium px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                Completed
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
