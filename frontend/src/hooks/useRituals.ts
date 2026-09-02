import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { executeCheckOut, executeMorningCheckIn, fetchCheckInContext } from '../api/rituals';
import { ExecuteCheckInRequest, ExecuteCheckOutRequest } from '../types/domain';

export function useCheckInContext(date: string) {
  return useQuery({
    queryKey: ['checkInContext', date],
    queryFn: () => fetchCheckInContext(date),
    enabled: Boolean(date),
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function useExecuteCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ date, payload }: { date: string; payload: ExecuteCheckInRequest }) =>
      executeMorningCheckIn(date, payload),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['daySession', variables.date], data);
      queryClient.invalidateQueries({ queryKey: ['daySession', variables.date] });
      queryClient.invalidateQueries({ queryKey: ['backlog'] });
      queryClient.invalidateQueries({ queryKey: ['checkInContext', variables.date] });
    },
  });
}

export function useExecuteCheckOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ date, payload }: { date: string; payload: ExecuteCheckOutRequest }) =>
      executeCheckOut(date, payload),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['daySession', variables.date], data);
      queryClient.invalidateQueries({ queryKey: ['daySession', variables.date] });
      queryClient.invalidateQueries({ queryKey: ['backlog'] });
      queryClient.invalidateQueries({ queryKey: ['checkInContext', variables.date] });
    },
  });
}
