import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import {
  useDaySession,
  useBacklog,
  useToggleTaskCompletion,
  useReorderDayTasks,
  usePullBacklogTask,
  useDemoteDayTask,
  useMoveTaskToBlocked,
  useUnblockTask,
  useCreateTodayTask,
  useCreateBacklogTask,
  useReorderBacklog,
} from '../../hooks/useBoard';
import { YesterdayRow } from './YesterdayRow';
import { TodayRow } from './TodayRow';
import { BlockedRow } from './BlockedRow';
import { BacklogRow } from './BacklogRow';
import { BlockerReasonModal } from './BlockerReasonModal';
import { DaySessionActionBar } from './DaySessionActionBar';
import { MorningCheckInBanner } from './MorningCheckInBanner';
import { MorningCheckInModal } from '../wizards/MorningCheckInModal';
import { CheckOutModal } from '../wizards/CheckOutModal';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface DailyBoardProps {
  date: string;
}

export const DailyBoard: React.FC<DailyBoardProps> = ({ date }) => {
  const { data: daySession, isLoading: sessionLoading, error: sessionError, refetch: refetchSession } =
    useDaySession(date);
  const { data: backlog, isLoading: backlogLoading, error: backlogError, refetch: refetchBacklog } =
    useBacklog();

  const toggleComplete = useToggleTaskCompletion(date);
  const reorderDayTasks = useReorderDayTasks(date);
  const pullBacklogTask = usePullBacklogTask(date);
  const demoteDayTask = useDemoteDayTask(date);
  const moveTaskToBlocked = useMoveTaskToBlocked(date);
  const unblockTask = useUnblockTask(date);
  const createTodayTask = useCreateTodayTask(date);
  const createBacklogTask = useCreateBacklogTask();
  const reorderBacklog = useReorderBacklog();

  // Blocker modal state
  const [blockerModalState, setBlockerModalState] = useState<{
    isOpen: boolean;
    dayTaskId: string;
    taskTitle: string;
  }>({
    isOpen: false,
    dayTaskId: '',
    taskTitle: '',
  });

  // Ritual wizard modals state
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [isCheckOutModalOpen, setIsCheckOutModalOpen] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const hasAutoOpenedRef = useRef(false);

  // Auto-launch Morning Check-In modal if session is not yet checked in
  useEffect(() => {
    if (
      daySession &&
      daySession.session &&
      !daySession.session.check_in_at &&
      !hasAutoOpenedRef.current
    ) {
      hasAutoOpenedRef.current = true;
      setIsCheckInModalOpen(true);
    }
  }, [daySession]);

  // Keyboard shortcut refs
  const todayQuickAddRef = useRef<HTMLInputElement>(null);
  const backlogQuickAddRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isInput) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        todayQuickAddRef.current?.focus();
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        backlogQuickAddRef.current?.focus();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        // Pull top item from Backlog
        if (backlog && backlog.tasks.length > 0) {
          const topTask = backlog.tasks[0];
          pullBacklogTask.mutate({ taskId: topTask.id, status: 'TODAY' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [backlog, pullBacklogTask]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceDroppable = source.droppableId;
    const destDroppable = destination.droppableId;

    // 1. Intra-row reordering in TODAY
    if (sourceDroppable === 'TODAY' && destDroppable === 'TODAY') {
      if (!daySession) return;
      const currentList = [...daySession.tasks.today];
      const [movedItem] = currentList.splice(source.index, 1);
      currentList.splice(destination.index, 0, movedItem);

      reorderDayTasks.mutate({
        status: 'TODAY',
        orderedDayTaskIds: currentList.map((t) => t.day_task_id),
      });
      return;
    }

    // 2. Intra-row reordering in BLOCKED
    if (sourceDroppable === 'BLOCKED' && destDroppable === 'BLOCKED') {
      if (!daySession) return;
      const currentList = [...daySession.tasks.blocked];
      const [movedItem] = currentList.splice(source.index, 1);
      currentList.splice(destination.index, 0, movedItem);

      reorderDayTasks.mutate({
        status: 'BLOCKED',
        orderedDayTaskIds: currentList.map((t) => t.day_task_id),
      });
      return;
    }

    // 3. Intra-row reordering in BACKLOG
    if (sourceDroppable === 'BACKLOG' && destDroppable === 'BACKLOG') {
      if (!backlog) return;
      const currentList = [...backlog.tasks];
      const [movedItem] = currentList.splice(source.index, 1);
      currentList.splice(destination.index, 0, movedItem);

      reorderBacklog.mutate(currentList.map((t) => t.id));
      return;
    }

    // 4. TODAY -> BLOCKED (Triggers Blocker Reason Modal)
    if (sourceDroppable === 'TODAY' && destDroppable === 'BLOCKED') {
      const item = daySession?.tasks.today.find((t) => t.day_task_id === draggableId);
      if (item) {
        setBlockerModalState({
          isOpen: true,
          dayTaskId: item.day_task_id,
          taskTitle: item.title,
        });
      }
      return;
    }

    // 5. BLOCKED -> TODAY (Unblocks)
    if (sourceDroppable === 'BLOCKED' && destDroppable === 'TODAY') {
      unblockTask.mutate({ dayTaskId: draggableId });
      return;
    }

    // 6. BACKLOG -> TODAY (Pulls from backlog)
    if (sourceDroppable === 'BACKLOG' && destDroppable === 'TODAY') {
      pullBacklogTask.mutate({
        taskId: draggableId,
        status: 'TODAY',
        priorityOrder: destination.index + 1,
      });
      return;
    }

    // 7. TODAY or BLOCKED -> BACKLOG (Demotes to backlog)
    if (
      (sourceDroppable === 'TODAY' || sourceDroppable === 'BLOCKED') &&
      destDroppable === 'BACKLOG'
    ) {
      demoteDayTask.mutate({ dayTaskId: draggableId });
      return;
    }
  };

  const handleConfirmBlocker = (reason: string) => {
    if (blockerModalState.dayTaskId) {
      moveTaskToBlocked.mutate({
        dayTaskId: blockerModalState.dayTaskId,
        blockerReason: reason,
      });
    }
    setBlockerModalState({ isOpen: false, dayTaskId: '', taskTitle: '' });
  };

  const handleCancelBlocker = () => {
    setBlockerModalState({ isOpen: false, dayTaskId: '', taskTitle: '' });
  };

  const isError = !!sessionError || !!backlogError;
  const isLoading = sessionLoading || backlogLoading;

  if (isLoading && !daySession && !backlog) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <RefreshCw className="h-8 w-8 animate-spin text-sky-400 mb-3" />
        <p className="text-sm font-medium">Loading execution board & backlog...</p>
      </div>
    );
  }

  if (isError && !daySession) {
    return (
      <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800/80 text-rose-200">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="h-6 w-6 text-rose-400 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold">Failed to load execution board</h3>
            <p className="text-xs text-rose-300/80 mt-1">
              {sessionError instanceof Error ? sessionError.message : 'Network error'}
            </p>
          </div>
          <button
            onClick={() => {
              refetchSession();
              refetchBacklog();
            }}
            className="ml-auto px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-medium border border-rose-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Filter backlog tasks to exclude tasks already committed to the day session
  const committedTaskIds = new Set<string>();
  if (daySession && daySession.tasks) {
    daySession.tasks.yesterday?.forEach((t) => committedTaskIds.add(t.task_id));
    daySession.tasks.today?.forEach((t) => committedTaskIds.add(t.task_id));
    daySession.tasks.blocked?.forEach((t) => committedTaskIds.add(t.task_id));
  }

  const uncommittedBacklogTasks = (backlog?.tasks || []).filter(
    (t) => !committedTaskIds.has(t.id) && !t.is_archived
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Day Session Action Bar */}
      <DaySessionActionBar
        session={daySession?.session}
        onStartCheckIn={() => setIsCheckInModalOpen(true)}
        onStartCheckOut={() => setIsCheckOutModalOpen(true)}
      />

      {/* Un-checked-in Reminder Banner */}
      {daySession?.session && !daySession.session.check_in_at && !isBannerDismissed && (
        <MorningCheckInBanner
          onStartCheckIn={() => setIsCheckInModalOpen(true)}
          onDismiss={() => setIsBannerDismissed(true)}
        />
      )}

      {/* Keyboard Shortcuts Helper Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 rounded-xl bg-slate-900/40 border border-slate-800/60 text-xs text-slate-400">
        <span className="font-semibold text-slate-300">Quick Shortcuts:</span>
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center space-x-1.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 rounded text-slate-300">N</kbd>
            <span>Add Today</span>
          </span>
          <span className="inline-flex items-center space-x-1.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 rounded text-slate-300">B</kbd>
            <span>Add Backlog</span>
          </span>
          <span className="inline-flex items-center space-x-1.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 rounded text-slate-300">P</kbd>
            <span>Pull Top Item</span>
          </span>
          <span className="inline-flex items-center space-x-1.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 rounded text-slate-300">Esc</kbd>
            <span>Dismiss</span>
          </span>
        </div>
      </div>

      {/* 4-Row Execution Board Container */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
          {/* Row 1: Yesterday */}
          <YesterdayRow tasks={daySession?.tasks?.yesterday || []} />

          {/* Row 2: Today */}
          <TodayRow
            tasks={daySession?.tasks?.today || []}
            onToggleComplete={(dayTaskId, isCompleted) =>
              toggleComplete.mutate({ dayTaskId, isCompleted })
            }
            onDemote={(dayTaskId) => demoteDayTask.mutate({ dayTaskId })}
            onAddTask={(title) => createTodayTask.mutate({ title })}
            isAddingTask={createTodayTask.isPending}
            quickAddRef={todayQuickAddRef}
          />

          {/* Row 3: Blocked */}
          <BlockedRow
            tasks={daySession?.tasks?.blocked || []}
            onToggleComplete={(dayTaskId, isCompleted) =>
              toggleComplete.mutate({ dayTaskId, isCompleted })
            }
            onDemote={(dayTaskId) => demoteDayTask.mutate({ dayTaskId })}
            onUnblock={(dayTaskId) => unblockTask.mutate({ dayTaskId })}
          />

          {/* Row 4: Backlog */}
          <BacklogRow
            tasks={uncommittedBacklogTasks}
            onPull={(taskId) => pullBacklogTask.mutate({ taskId, status: 'TODAY' })}
            onAddTask={(title) => createBacklogTask.mutate({ title })}
            isAddingTask={createBacklogTask.isPending}
            quickAddRef={backlogQuickAddRef}
          />
        </div>
      </DragDropContext>

      {/* Blocker Reason Modal */}
      <BlockerReasonModal
        isOpen={blockerModalState.isOpen}
        taskTitle={blockerModalState.taskTitle}
        onConfirm={handleConfirmBlocker}
        onCancel={handleCancelBlocker}
      />

      {/* Morning Check-In Wizard Modal */}
      <MorningCheckInModal
        isOpen={isCheckInModalOpen}
        onClose={() => setIsCheckInModalOpen(false)}
        date={date}
      />

      {/* End-of-Day Check-Out Modal */}
      <CheckOutModal
        isOpen={isCheckOutModalOpen}
        onClose={() => setIsCheckOutModalOpen(false)}
        date={date}
        sessionWithTasks={daySession}
      />
    </div>
  );
};
