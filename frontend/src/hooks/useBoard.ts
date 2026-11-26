import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchBacklog,
  fetchDaySession,
  updateDaySession,
  updateDayTask,
  updateTask,
  archiveTask,
  moveTaskToDate,
  pullBacklogTask,
  demoteDayTask,
  reorderDayTasksDirect,
  createTask,
  createBacklogTask,
  reorderBacklog,
  fetchCompletedTasksReport,
} from '../api/tasks';
import {
  BacklogResponse,
  DaySessionWithTasks,
  DayStatus,
  DayTaskWithDetails,
  MasterTask,
  MoveTaskToDatePayload,
  Subtask,
} from '../types/domain';

export const queryKeys = {
  daySession: (date: string) => ['daySession', date] as const,
  backlog: (today?: string) => (today ? (['backlog', today] as const) : (['backlog'] as const)),
  completedReport: (start: string, end: string) => ['completedReport', start, end] as const,
};

export function useDaySession(date: string) {
  return useQuery({
    queryKey: queryKeys.daySession(date),
    queryFn: () => fetchDaySession(date),
    enabled: !!date,
  });
}

export function useBacklog(today?: string) {
  return useQuery({
    queryKey: queryKeys.backlog(today),
    queryFn: () => fetchBacklog(today),
  });
}

export function useToggleTaskCompletion(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ dayTaskId, isCompleted }: { dayTaskId: string; isCompleted: boolean }) =>
      updateDayTask(date, dayTaskId, { is_completed: isCompleted }),
    onMutate: async ({ dayTaskId, isCompleted }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.daySession(date) });

      const prevData = queryClient.getQueryData<DaySessionWithTasks>(queryKeys.daySession(date));
      if (!prevData) return { prevData };

      const updateList = (list: DayTaskWithDetails[]) =>
        list.map((item) =>
          item.day_task_id === dayTaskId
            ? {
                ...item,
                is_completed: isCompleted,
                completed_at: isCompleted ? new Date().toISOString() : null,
                subtasks: isCompleted
                  ? (item.subtasks || []).map((s) => ({ ...s, is_completed: true }))
                  : item.subtasks || [],
              }
            : item
        );

      const optimisticData: DaySessionWithTasks = {
        ...prevData,
        tasks: {
          ...prevData.tasks,
          today: updateList(prevData.tasks.today || []),
          blocked: updateList(prevData.tasks.blocked || []),
          yesterday: updateList(prevData.tasks.yesterday || []),
        },
      };

      queryClient.setQueryData(queryKeys.daySession(date), optimisticData);
      return { prevData };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevData) {
        queryClient.setQueryData(queryKeys.daySession(date), context.prevData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.daySession(date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.backlog() });
    },
  });
}

export function useReorderDayTasks(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      status,
      orderedDayTaskIds,
    }: {
      status: DayStatus;
      orderedDayTaskIds: string[];
    }) =>
      reorderDayTasksDirect({
        day_session_date: date,
        status,
        ordered_day_task_ids: orderedDayTaskIds,
      }),
    onMutate: async ({ status, orderedDayTaskIds }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.daySession(date) });
      const prevData = queryClient.getQueryData<DaySessionWithTasks>(queryKeys.daySession(date));
      if (!prevData) return { prevData };

      const sortList = (list: DayTaskWithDetails[]) => {
        const map = new Map(list.map((item) => [item.day_task_id, item]));
        return orderedDayTaskIds
          .map((id, index) => {
            const item = map.get(id);
            return item ? { ...item, priority_order: index + 1 } : null;
          })
          .filter((item): item is DayTaskWithDetails => item !== null);
      };

      const optimisticData: DaySessionWithTasks = {
        ...prevData,
        tasks: {
          ...prevData.tasks,
          today: status === 'TODAY' ? sortList(prevData.tasks.today) : prevData.tasks.today,
          blocked: status === 'BLOCKED' ? sortList(prevData.tasks.blocked) : prevData.tasks.blocked,
        },
      };

      queryClient.setQueryData(queryKeys.daySession(date), optimisticData);
      return { prevData };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevData) {
        queryClient.setQueryData(queryKeys.daySession(date), context.prevData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.daySession(date) });
    },
  });
}

export function usePullBacklogTask(date: string, today?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      status = 'TODAY',
      priorityOrder,
      todayDate,
    }: {
      taskId: string;
      status?: DayStatus;
      priorityOrder?: number;
      todayDate?: string;
    }) =>
      pullBacklogTask(date, {
        task_id: taskId,
        status,
        priority_order: priorityOrder,
        today_date: todayDate ?? today,
      }),
    onMutate: async ({ taskId, status = 'TODAY' }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.daySession(date) });
      await queryClient.cancelQueries({ queryKey: queryKeys.backlog() });

      const prevSession = queryClient.getQueryData<DaySessionWithTasks>(queryKeys.daySession(date));
      const prevBacklogs = queryClient.getQueriesData<BacklogResponse>({ queryKey: queryKeys.backlog() });

      let pulledMaster: MasterTask | undefined;
      for (const [, data] of prevBacklogs) {
        const found = data?.tasks?.find((t) => t.id === taskId);
        if (found) {
          pulledMaster = found;
          break;
        }
      }

      if (prevSession && pulledMaster) {
        const optimisticDayTask: DayTaskWithDetails = {
          day_task_id: `temp-${Date.now()}`,
          task_id: pulledMaster.id,
          title: pulledMaster.title,
          description: pulledMaster.description,
          status,
          is_completed: false,
          completed_at: null,
          priority_order: (prevSession.tasks.today || []).length + 1,
          blocker_reason: null,
          subtasks: pulledMaster.subtasks || [],
        };

        queryClient.setQueryData<DaySessionWithTasks>(queryKeys.daySession(date), {
          ...prevSession,
          tasks: {
            ...prevSession.tasks,
            today: [...(prevSession.tasks.today || []), optimisticDayTask],
          },
        });
      }

      queryClient.setQueriesData<BacklogResponse>({ queryKey: queryKeys.backlog() }, (old) => {
        if (!old) return old;
        return {
          tasks: (old.tasks || []).filter((t) => t.id !== taskId),
        };
      });

      return { prevSession, prevBacklogs };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevSession) {
        queryClient.setQueryData(queryKeys.daySession(date), context.prevSession);
      }
      context?.prevBacklogs?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.daySession(date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.backlog() });
    },
  });
}

export function useDemoteDayTask(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ dayTaskId }: { dayTaskId: string }) => demoteDayTask(date, dayTaskId),
    onMutate: async ({ dayTaskId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.daySession(date) });
      await queryClient.cancelQueries({ queryKey: queryKeys.backlog() });

      const prevSession = queryClient.getQueryData<DaySessionWithTasks>(queryKeys.daySession(date));
      const prevBacklogs = queryClient.getQueriesData<BacklogResponse>({ queryKey: queryKeys.backlog() });

      const demotingItem =
        prevSession?.tasks.today?.find((t) => t.day_task_id === dayTaskId) ||
        prevSession?.tasks.blocked?.find((t) => t.day_task_id === dayTaskId);

      if (prevSession && demotingItem) {
        queryClient.setQueryData<DaySessionWithTasks>(queryKeys.daySession(date), {
          ...prevSession,
          tasks: {
            ...prevSession.tasks,
            today: (prevSession.tasks.today || []).filter((t) => t.day_task_id !== dayTaskId),
            blocked: (prevSession.tasks.blocked || []).filter((t) => t.day_task_id !== dayTaskId),
          },
        });

        queryClient.setQueriesData<BacklogResponse>({ queryKey: queryKeys.backlog() }, (old) => {
          if (!old) return old;
          const restoredTask: MasterTask = {
            id: demotingItem.task_id,
            user_id: '',
            title: demotingItem.title,
            description: demotingItem.description,
            is_completed: demotingItem.is_completed,
            completed_at: demotingItem.completed_at,
            is_archived: false,
            backlog_order: (old.tasks || []).length + 1,
            subtasks: demotingItem.subtasks || [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          return {
            tasks: [...(old.tasks || []), restoredTask],
          };
        });
      }

      return { prevSession, prevBacklogs };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevSession) {
        queryClient.setQueryData(queryKeys.daySession(date), context.prevSession);
      }
      context?.prevBacklogs?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.daySession(date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.backlog() });
    },
  });
}

export function useMoveTaskToBlocked(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      dayTaskId,
      blockerReason,
    }: {
      dayTaskId: string;
      blockerReason: string;
    }) =>
      updateDayTask(date, dayTaskId, {
        status: 'BLOCKED',
        blocker_reason: blockerReason,
      }),
    onMutate: async ({ dayTaskId, blockerReason }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.daySession(date) });
      const prevData = queryClient.getQueryData<DaySessionWithTasks>(queryKeys.daySession(date));
      if (!prevData) return { prevData };

      const item = prevData.tasks.today.find((t) => t.day_task_id === dayTaskId);
      if (!item) return { prevData };

      const updatedItem: DayTaskWithDetails = {
        ...item,
        status: 'BLOCKED',
        blocker_reason: blockerReason,
      };

      queryClient.setQueryData<DaySessionWithTasks>(queryKeys.daySession(date), {
        ...prevData,
        tasks: {
          ...prevData.tasks,
          today: prevData.tasks.today.filter((t) => t.day_task_id !== dayTaskId),
          blocked: [...prevData.tasks.blocked, updatedItem],
        },
      });

      return { prevData };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevData) {
        queryClient.setQueryData(queryKeys.daySession(date), context.prevData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.daySession(date) });
    },
  });
}

export function useUnblockTask(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ dayTaskId }: { dayTaskId: string }) =>
      updateDayTask(date, dayTaskId, {
        status: 'TODAY',
        blocker_reason: null,
      }),
    onMutate: async ({ dayTaskId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.daySession(date) });
      const prevData = queryClient.getQueryData<DaySessionWithTasks>(queryKeys.daySession(date));
      if (!prevData) return { prevData };

      const item = prevData.tasks.blocked.find((t) => t.day_task_id === dayTaskId);
      if (!item) return { prevData };

      const updatedItem: DayTaskWithDetails = {
        ...item,
        status: 'TODAY',
        blocker_reason: null,
        priority_order: prevData.tasks.today.length + 1,
      };

      queryClient.setQueryData<DaySessionWithTasks>(queryKeys.daySession(date), {
        ...prevData,
        tasks: {
          ...prevData.tasks,
          blocked: prevData.tasks.blocked.filter((t) => t.day_task_id !== dayTaskId),
          today: [...prevData.tasks.today, updatedItem],
        },
      });

      return { prevData };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevData) {
        queryClient.setQueryData(queryKeys.daySession(date), context.prevData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.daySession(date) });
    },
  });
}

export function useCreateTodayTask(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      title,
      description,
      status = 'TODAY',
    }: {
      title: string;
      description?: string;
      status?: DayStatus;
    }) =>
      createTask({
        title,
        description,
        target_date: date,
        status,
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.daySession(date) });
    },
  });
}

export function useCreateBacklogTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ title, description }: { title: string; description?: string }) =>
      createBacklogTask({
        title,
        description,
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backlog() });
    },
  });
}

export function useReorderBacklog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderedTaskIds: string[]) => reorderBacklog(orderedTaskIds),
    onMutate: async (orderedTaskIds) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.backlog() });
      const prevBacklogs = queryClient.getQueriesData<BacklogResponse>({ queryKey: queryKeys.backlog() });

      queryClient.setQueriesData<BacklogResponse>({ queryKey: queryKeys.backlog() }, (old) => {
        if (!old) return old;
        const map = new Map((old.tasks || []).map((t) => [t.id, t]));
        const sorted = orderedTaskIds
          .map((id, idx) => {
            const item = map.get(id);
            return item ? { ...item, backlog_order: idx + 1 } : null;
          })
          .filter((t): t is MasterTask => t !== null);
        return { tasks: sorted };
      });

      return { prevBacklogs };
    },
    onError: (_err, _vars, context) => {
      context?.prevBacklogs?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backlog() });
    },
  });
}

export function useUpdateTask(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      title,
      description,
      subtasks,
    }: {
      taskId: string;
      title?: string;
      description?: string;
      subtasks?: Subtask[];
    }) => updateTask(taskId, { title, description, subtasks }),
    onMutate: async ({ taskId, title, description, subtasks }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.daySession(date) });
      await queryClient.cancelQueries({ queryKey: queryKeys.backlog() });

      const prevSession = queryClient.getQueryData<DaySessionWithTasks>(queryKeys.daySession(date));
      const prevBacklogs = queryClient.getQueriesData<BacklogResponse>({ queryKey: queryKeys.backlog() });

      if (prevSession) {
        const updateList = (list: DayTaskWithDetails[]) =>
          list.map((t) =>
            t.task_id === taskId
              ? {
                  ...t,
                  title: title ?? t.title,
                  description: description ?? t.description,
                  subtasks: subtasks ?? t.subtasks ?? [],
                }
              : t
          );
        queryClient.setQueryData<DaySessionWithTasks>(queryKeys.daySession(date), {
          ...prevSession,
          tasks: {
            ...prevSession.tasks,
            today: updateList(prevSession.tasks.today || []),
            blocked: updateList(prevSession.tasks.blocked || []),
          },
        });
      }

      queryClient.setQueriesData<BacklogResponse>({ queryKey: queryKeys.backlog() }, (old) => {
        if (!old) return old;
        return {
          tasks: (old.tasks || []).map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  title: title ?? t.title,
                  description: description ?? t.description,
                  subtasks: subtasks ?? t.subtasks ?? [],
                }
              : t
          ),
        };
      });

      return { prevSession, prevBacklogs };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevSession) {
        queryClient.setQueryData(queryKeys.daySession(date), context.prevSession);
      }
      context?.prevBacklogs?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.daySession(date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.backlog() });
    },
  });
}

export function useMoveTaskToDate(sourceDate: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      payload,
    }: {
      taskId: string;
      payload: MoveTaskToDatePayload;
    }) => moveTaskToDate(taskId, payload),
    onSettled: (_data, _err, variables) => {
      if (sourceDate) {
        queryClient.invalidateQueries({ queryKey: queryKeys.daySession(sourceDate) });
      }
      if (variables.payload.source_date && variables.payload.source_date !== sourceDate) {
        queryClient.invalidateQueries({ queryKey: queryKeys.daySession(variables.payload.source_date) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.daySession(variables.payload.target_date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.backlog() });
    },
  });
}

export function useArchiveTask(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId }: { taskId: string }) => archiveTask(taskId),
    onMutate: async ({ taskId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.daySession(date) });
      await queryClient.cancelQueries({ queryKey: queryKeys.backlog() });

      const prevSession = queryClient.getQueryData<DaySessionWithTasks>(queryKeys.daySession(date));
      const prevBacklogs = queryClient.getQueriesData<BacklogResponse>({ queryKey: queryKeys.backlog() });

      if (prevSession) {
        queryClient.setQueryData<DaySessionWithTasks>(queryKeys.daySession(date), {
          ...prevSession,
          tasks: {
            ...prevSession.tasks,
            today: (prevSession.tasks.today || []).filter((t) => t.task_id !== taskId),
            blocked: (prevSession.tasks.blocked || []).filter((t) => t.task_id !== taskId),
          },
        });
      }

      queryClient.setQueriesData<BacklogResponse>({ queryKey: queryKeys.backlog() }, (old) => {
        if (!old) return old;
        return {
          tasks: (old.tasks || []).filter((t) => t.id !== taskId),
        };
      });

      return { prevSession, prevBacklogs };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevSession) {
        queryClient.setQueryData(queryKeys.daySession(date), context.prevSession);
      }
      context?.prevBacklogs?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.daySession(date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.backlog() });
    },
  });
}


export function useCompletedTasksReport(startDate: string, endDate: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.completedReport(startDate, endDate),
    queryFn: () => fetchCompletedTasksReport(startDate, endDate),
    enabled: enabled && !!startDate && !!endDate,
  });
}

export function useUpdateDayNotes(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ notes }: { notes: string }) => updateDaySession(date, { notes }),
    onMutate: async ({ notes }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.daySession(date) });
      const prevSession = queryClient.getQueryData<DaySessionWithTasks>(queryKeys.daySession(date));
      if (prevSession) {
        queryClient.setQueryData<DaySessionWithTasks>(queryKeys.daySession(date), {
          ...prevSession,
          session: { ...prevSession.session, notes },
        });
      }
      return { prevSession };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevSession) {
        queryClient.setQueryData(queryKeys.daySession(date), context.prevSession);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.daySession(date) });
    },
  });
}
