import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchBacklog,
  fetchDaySession,
  patchDayTask,
  pullBacklogTask,
  demoteDayTask,
  reorderDayTasksDirect,
  createTask,
  createBacklogTask,
  reorderBacklog,
} from '../api/tasks';
import {
  BacklogResponse,
  DaySessionWithTasks,
  DayStatus,
  DayTaskWithDetails,
  MasterTask,
} from '../types/domain';

export const queryKeys = {
  daySession: (date: string) => ['daySession', date] as const,
  backlog: () => ['backlog'] as const,
};

export function useDaySession(date: string) {
  return useQuery({
    queryKey: queryKeys.daySession(date),
    queryFn: () => fetchDaySession(date),
    enabled: !!date,
  });
}

export function useBacklog() {
  return useQuery({
    queryKey: queryKeys.backlog(),
    queryFn: fetchBacklog,
  });
}

export function useToggleTaskCompletion(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ dayTaskId, isCompleted }: { dayTaskId: string; isCompleted: boolean }) =>
      patchDayTask(dayTaskId, { is_completed: isCompleted }),
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
              }
            : item
        );

      const optimisticData: DaySessionWithTasks = {
        ...prevData,
        tasks: {
          ...prevData.tasks,
          today: updateList(prevData.tasks.today),
          blocked: updateList(prevData.tasks.blocked),
          yesterday: updateList(prevData.tasks.yesterday),
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

export function usePullBacklogTask(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      status = 'TODAY',
      priorityOrder,
    }: {
      taskId: string;
      status?: DayStatus;
      priorityOrder?: number;
    }) => pullBacklogTask(date, { task_id: taskId, status, priority_order: priorityOrder }),
    onMutate: async ({ taskId, status = 'TODAY' }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.daySession(date) });
      await queryClient.cancelQueries({ queryKey: queryKeys.backlog() });

      const prevSession = queryClient.getQueryData<DaySessionWithTasks>(queryKeys.daySession(date));
      const prevBacklog = queryClient.getQueryData<BacklogResponse>(queryKeys.backlog());

      const pulledMaster = prevBacklog?.tasks.find((t) => t.id === taskId);

      if (prevSession && pulledMaster) {
        const optimisticDayTask: DayTaskWithDetails = {
          day_task_id: `temp-${Date.now()}`,
          task_id: pulledMaster.id,
          title: pulledMaster.title,
          description: pulledMaster.description,
          status,
          is_completed: false,
          completed_at: null,
          priority_order: prevSession.tasks.today.length + 1,
          blocker_reason: null,
        };

        queryClient.setQueryData<DaySessionWithTasks>(queryKeys.daySession(date), {
          ...prevSession,
          tasks: {
            ...prevSession.tasks,
            today: [...prevSession.tasks.today, optimisticDayTask],
          },
        });
      }

      if (prevBacklog) {
        queryClient.setQueryData<BacklogResponse>(queryKeys.backlog(), {
          tasks: prevBacklog.tasks.filter((t) => t.id !== taskId),
        });
      }

      return { prevSession, prevBacklog };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevSession) {
        queryClient.setQueryData(queryKeys.daySession(date), context.prevSession);
      }
      if (context?.prevBacklog) {
        queryClient.setQueryData(queryKeys.backlog(), context.prevBacklog);
      }
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
      const prevBacklog = queryClient.getQueryData<BacklogResponse>(queryKeys.backlog());

      const demotingItem = prevSession?.tasks.today.find((t) => t.day_task_id === dayTaskId) ||
        prevSession?.tasks.blocked.find((t) => t.day_task_id === dayTaskId);

      if (prevSession && demotingItem) {
        queryClient.setQueryData<DaySessionWithTasks>(queryKeys.daySession(date), {
          ...prevSession,
          tasks: {
            ...prevSession.tasks,
            today: prevSession.tasks.today.filter((t) => t.day_task_id !== dayTaskId),
            blocked: prevSession.tasks.blocked.filter((t) => t.day_task_id !== dayTaskId),
          },
        });

        if (prevBacklog) {
          const restoredTask: MasterTask = {
            id: demotingItem.task_id,
            user_id: '',
            title: demotingItem.title,
            description: demotingItem.description,
            is_completed: demotingItem.is_completed,
            completed_at: demotingItem.completed_at,
            is_archived: false,
            backlog_order: prevBacklog.tasks.length + 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          queryClient.setQueryData<BacklogResponse>(queryKeys.backlog(), {
            tasks: [...prevBacklog.tasks, restoredTask],
          });
        }
      }

      return { prevSession, prevBacklog };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevSession) {
        queryClient.setQueryData(queryKeys.daySession(date), context.prevSession);
      }
      if (context?.prevBacklog) {
        queryClient.setQueryData(queryKeys.backlog(), context.prevBacklog);
      }
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
      patchDayTask(dayTaskId, {
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
      patchDayTask(dayTaskId, {
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
    mutationFn: ({ title, description }: { title: string; description?: string }) =>
      createTask({
        title,
        description,
        target_date: date,
        status: 'TODAY',
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
      const prevBacklog = queryClient.getQueryData<BacklogResponse>(queryKeys.backlog());
      if (!prevBacklog) return { prevBacklog };

      const map = new Map(prevBacklog.tasks.map((t) => [t.id, t]));
      const sorted = orderedTaskIds
        .map((id, idx) => {
          const item = map.get(id);
          return item ? { ...item, backlog_order: idx + 1 } : null;
        })
        .filter((t): t is MasterTask => t !== null);

      queryClient.setQueryData<BacklogResponse>(queryKeys.backlog(), { tasks: sorted });
      return { prevBacklog };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevBacklog) {
        queryClient.setQueryData(queryKeys.backlog(), context.prevBacklog);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backlog() });
    },
  });
}
