import React, { useState, useEffect, useRef } from 'react';
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
  useUpdateTask,
  useArchiveTask,
  useUpdateDayNotes,
} from '../../hooks/useBoard';
import { YesterdayRow } from './YesterdayRow';
import { TodayRow } from './TodayRow';
import { BlockedRow } from './BlockedRow';
import { BacklogRow } from './BacklogRow';
import { TaskCardData } from './TaskCard';
import { BlockerReasonModal } from './BlockerReasonModal';
import { EditTaskModal } from './EditTaskModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { DailyNotesModal } from './DailyNotesModal';
import { getRelativeSectionLabels } from '../../utils/dateLabels';
import { DaySessionActionBar } from './DaySessionActionBar';
import { MorningCheckInBanner } from './MorningCheckInBanner';
import { MorningCheckInModal } from '../wizards/MorningCheckInModal';
import { CheckOutModal } from '../wizards/CheckOutModal';
import { HistoricalDateBanner } from '../navigation/HistoricalDateBanner';
import { StandupExportModal } from '../standup/StandupExportModal';
import { useDateContext } from '../../context/DateContext';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface DailyBoardProps {
  date: string;
  isReadOnly?: boolean;
}

export const DailyBoard: React.FC<DailyBoardProps> = ({ date, isReadOnly }) => {
  let dateContext: ReturnType<typeof useDateContext> | null = null;
  try {
    dateContext = useDateContext();
  } catch {
    // fallback when rendered outside DateProvider in unit tests
  }
  const isHistorical = isReadOnly ?? (dateContext?.isHistorical ?? false);

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
  const updateTaskMutation = useUpdateTask(date);
  const archiveTaskMutation = useArchiveTask(date);
  const updateDayNotesMutation = useUpdateDayNotes(date);
  const { yesterdayLabel, todayLabel } = getRelativeSectionLabels(date);

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

  // Edit, Create & Delete modal state
  const [editingTask, setEditingTask] = useState<TaskCardData | null>(null);
  const [detailedAddTarget, setDetailedAddTarget] = useState<'TODAY' | 'BLOCKED' | 'BACKLOG' | null>(null);
  const [deletingTask, setDeletingTask] = useState<TaskCardData | null>(null);

  // Ritual wizard modals state
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [isCheckOutModalOpen, setIsCheckOutModalOpen] = useState(false);
  const [isStandupModalOpen, setIsStandupModalOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const hasAutoOpenedRef = useRef(false);

  // Auto-launch Morning Check-In modal if session is not yet checked in (suppressed for historical dates)
  useEffect(() => {
    if (isHistorical) return;
    if (
      daySession &&
      daySession.session &&
      !daySession.session.check_in_at &&
      !hasAutoOpenedRef.current
    ) {
      hasAutoOpenedRef.current = true;
      setIsCheckInModalOpen(true);
    }
  }, [daySession, isHistorical]);

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

  const moveItemToIndex = <T,>(items: T[], fromIndex: number, toIndex: number): T[] | null => {
    if (
      fromIndex < 0 ||
      fromIndex >= items.length ||
      toIndex < 0 ||
      toIndex >= items.length ||
      fromIndex === toIndex
    ) {
      return null;
    }
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  };

  const handleMoveDayTask = (status: 'TODAY' | 'BLOCKED', index: number, direction: -1 | 1) => {
    handleMoveDayTaskToIndex(status, index, index + direction);
  };

  const handleMoveDayTaskToIndex = (status: 'TODAY' | 'BLOCKED', fromIndex: number, toIndex: number) => {
    if (isHistorical || !daySession) return;
    const list = status === 'TODAY' ? daySession.tasks.today : daySession.tasks.blocked;
    const reordered = moveItemToIndex(list, fromIndex, toIndex);
    if (!reordered) return;
    reorderDayTasks.mutate({
      status,
      orderedDayTaskIds: reordered.map((t) => t.day_task_id),
    });
  };

  const handleMoveBacklogTask = (
    uncommittedTasks: NonNullable<typeof backlog>['tasks'],
    index: number,
    direction: -1 | 1
  ) => {
    handleMoveBacklogTaskToIndex(uncommittedTasks, index, index + direction);
  };

  const handleMoveBacklogTaskToIndex = (
    uncommittedTasks: NonNullable<typeof backlog>['tasks'],
    fromIndex: number,
    toIndex: number
  ) => {
    if (isHistorical) return;
    const reordered = moveItemToIndex(uncommittedTasks, fromIndex, toIndex);
    if (!reordered) return;
    reorderBacklog.mutate(reordered.map((t) => t.id));
  };

  const handleOpenBlockerModal = (dayTaskId: string, taskTitle: string) => {
    if (isHistorical) return;
    setBlockerModalState({
      isOpen: true,
      dayTaskId,
      taskTitle,
    });
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

  const handleConfirmEdit = (title: string, description: string) => {
    if (!editingTask) return;
    updateTaskMutation.mutate(
      { taskId: editingTask.taskId, title, description },
      { onSuccess: () => setEditingTask(null) }
    );
  };

  const handleConfirmDetailedAdd = (title: string, description: string) => {
    if (!detailedAddTarget) return;
    if (detailedAddTarget === 'BACKLOG') {
      createBacklogTask.mutate(
        { title, description: description || undefined },
        { onSuccess: () => setDetailedAddTarget(null) }
      );
      return;
    }
    createTodayTask.mutate(
      { title, description: description || undefined, status: detailedAddTarget },
      { onSuccess: () => setDetailedAddTarget(null) }
    );
  };

  const handleConfirmDelete = () => {
    if (!deletingTask) return;
    archiveTaskMutation.mutate(
      { taskId: deletingTask.taskId },
      { onSuccess: () => setDeletingTask(null) }
    );
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
    (t) => !committedTaskIds.has(t.id) && !t.is_archived && !t.is_completed
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Historical Read-Only Banner */}
      <HistoricalDateBanner />

      {/* Day Session Action Bar */}
      <DaySessionActionBar
        session={daySession?.session}
        onStartCheckIn={() => setIsCheckInModalOpen(true)}
        onStartCheckOut={() => setIsCheckOutModalOpen(true)}
        onExportStandup={() => setIsStandupModalOpen(true)}
        onOpenNotes={() => setIsNotesModalOpen(true)}
        isReadOnly={isHistorical}
      />

      {/* Un-checked-in Reminder Banner (suppressed on historical dates) */}
      {!isHistorical && daySession?.session && !daySession.session.check_in_at && !isBannerDismissed && (
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
      <div
        data-testid="daily-board-rows"
        className="flex flex-col gap-5"
      >
        {/* Row 1: Yesterday */}
        <YesterdayRow tasks={daySession?.tasks?.yesterday || []} title={yesterdayLabel} />

        {/* Row 2: Today */}
        <TodayRow
          tasks={daySession?.tasks?.today || []}
          title={todayLabel}
          isReadOnly={isHistorical}
          onToggleComplete={(dayTaskId, isCompleted) =>
            toggleComplete.mutate({ dayTaskId, isCompleted })
          }
          onDemote={(dayTaskId) => demoteDayTask.mutate({ dayTaskId })}
          onBlock={handleOpenBlockerModal}
          onMoveUp={(index) => handleMoveDayTask('TODAY', index, -1)}
          onMoveDown={(index) => handleMoveDayTask('TODAY', index, 1)}
          onMoveToIndex={(fromIdx, toIdx) => handleMoveDayTaskToIndex('TODAY', fromIdx, toIdx)}
          onEdit={(task) => setEditingTask(task)}
          onDelete={(task) => setDeletingTask(task)}
          onAddTask={(title) => createTodayTask.mutate({ title, status: 'TODAY' })}
          onOpenDetailedAdd={() => setDetailedAddTarget('TODAY')}
          isAddingTask={createTodayTask.isPending}
          quickAddRef={todayQuickAddRef}
        />

        {/* Row 3: Blocked */}
        <BlockedRow
          tasks={daySession?.tasks?.blocked || []}
          isReadOnly={isHistorical}
          onToggleComplete={(dayTaskId, isCompleted) =>
            toggleComplete.mutate({ dayTaskId, isCompleted })
          }
          onDemote={(dayTaskId) => demoteDayTask.mutate({ dayTaskId })}
          onUnblock={(dayTaskId) => unblockTask.mutate({ dayTaskId })}
          onMoveUp={(index) => handleMoveDayTask('BLOCKED', index, -1)}
          onMoveDown={(index) => handleMoveDayTask('BLOCKED', index, 1)}
          onMoveToIndex={(fromIdx, toIdx) => handleMoveDayTaskToIndex('BLOCKED', fromIdx, toIdx)}
          onEdit={(task) => setEditingTask(task)}
          onDelete={(task) => setDeletingTask(task)}
          onAddTask={(title) => createTodayTask.mutate({ title, status: 'BLOCKED' })}
          onOpenDetailedAdd={() => setDetailedAddTarget('BLOCKED')}
          isAddingTask={createTodayTask.isPending}
        />

        {/* Row 4: Backlog */}
        <BacklogRow
          tasks={uncommittedBacklogTasks}
          onPull={(taskId) => pullBacklogTask.mutate({ taskId, status: 'TODAY' })}
          onMoveUp={(index) => handleMoveBacklogTask(uncommittedBacklogTasks, index, -1)}
          onMoveDown={(index) => handleMoveBacklogTask(uncommittedBacklogTasks, index, 1)}
          onMoveToIndex={(fromIdx, toIdx) => handleMoveBacklogTaskToIndex(uncommittedBacklogTasks, fromIdx, toIdx)}
          onEdit={(task) => setEditingTask(task)}
          onDelete={(task) => setDeletingTask(task)}
          onAddTask={(title) => createBacklogTask.mutate({ title })}
          onOpenDetailedAdd={() => setDetailedAddTarget('BACKLOG')}
          isAddingTask={createBacklogTask.isPending}
          quickAddRef={backlogQuickAddRef}
        />
      </div>

      {/* Blocker Reason Modal */}
      <BlockerReasonModal
        isOpen={blockerModalState.isOpen}
        taskTitle={blockerModalState.taskTitle}
        onConfirm={handleConfirmBlocker}
        onCancel={handleCancelBlocker}
      />

      {/* Edit Task Modal */}
      <EditTaskModal
        isOpen={!!editingTask}
        mode="edit"
        initialTitle={editingTask?.title ?? ''}
        initialDescription={editingTask?.description ?? ''}
        onConfirm={handleConfirmEdit}
        onCancel={() => setEditingTask(null)}
        isSaving={updateTaskMutation.isPending}
      />

      {/* Detailed Add Task Modal */}
      <EditTaskModal
        isOpen={!!detailedAddTarget}
        mode="create"
        targetLabel={
          detailedAddTarget === 'TODAY'
            ? 'Today'
            : detailedAddTarget === 'BLOCKED'
            ? 'Blocked'
            : 'Backlog'
        }
        initialTitle=""
        initialDescription=""
        onConfirm={handleConfirmDetailedAdd}
        onCancel={() => setDetailedAddTarget(null)}
        isSaving={createTodayTask.isPending || createBacklogTask.isPending}
      />

      {/* Delete Task Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingTask}
        taskTitle={deletingTask?.title ?? ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingTask(null)}
        isDeleting={archiveTaskMutation.isPending}
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

      {/* Standup Export Modal */}
      <StandupExportModal
        isOpen={isStandupModalOpen}
        onClose={() => setIsStandupModalOpen(false)}
        sessionWithTasks={daySession}
        dateStr={date}
      />

      {/* Daily Notes Modal */}
      <DailyNotesModal
        isOpen={isNotesModalOpen}
        dateLabel={todayLabel === 'Today' ? date : todayLabel}
        initialNotes={daySession?.session?.notes ?? ''}
        isReadOnly={isHistorical}
        isSaving={updateDayNotesMutation.isPending}
        onSave={(notes) => {
          updateDayNotesMutation.mutate(
            { notes },
            { onSuccess: () => setIsNotesModalOpen(false) }
          );
        }}
        onClose={() => setIsNotesModalOpen(false)}
      />
    </div>
  );
};
