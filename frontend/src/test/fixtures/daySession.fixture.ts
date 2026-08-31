import { DaySessionWithTasks, BacklogResponse } from '../../types/domain';

export const mockDaySessionFixture: DaySessionWithTasks = {
  session: {
    id: '2026-08-28',
    user_id: 'user-sample-001',
    date: '2026-08-28',
    check_in_at: '2026-08-28T09:00:00Z',
    check_out_at: null,
    notes: 'Focus on Firestore repository batch queries and emulator health verification.',
    created_at: '2026-08-28T08:55:00Z',
    updated_at: '2026-08-28T09:00:00Z',
  },
  tasks: {
    yesterday: [
      {
        day_task_id: 'dt-yesterday-1',
        task_id: 'task-auth-client',
        title: 'Refactor auth client & token refresh',
        description: 'Ensure token interceptor gracefully handles expired Firebase tokens.',
        status: 'YESTERDAY',
        is_completed: true,
        completed_at: '2026-08-27T17:30:00Z',
        priority_order: 1,
        blocker_reason: null,
      },
    ],
    today: [
      {
        day_task_id: 'dt-today-1',
        task_id: 'task-firestore-repo',
        title: 'Implement Firestore TaskRepository with batch get',
        description: 'Use client.GetAll() to batch fetch master task documents in a single round-trip.',
        status: 'TODAY',
        is_completed: false,
        completed_at: null,
        priority_order: 1,
        blocker_reason: null,
      },
      {
        day_task_id: 'dt-today-2',
        task_id: 'task-day-session-join',
        title: 'Wire single-call DaySession joined service method',
        description: 'Assemble DaySessionWithTasks partitioning into yesterday, today, and blocked arrays.',
        status: 'TODAY',
        is_completed: false,
        completed_at: null,
        priority_order: 2,
        blocker_reason: null,
      },
    ],
    blocked: [
      {
        day_task_id: 'dt-blocked-1',
        task_id: 'task-cloud-deploy',
        title: 'Provision Cloud Run staging environment',
        description: 'Blocked waiting on DevOps GCP IAM service account role binding.',
        status: 'BLOCKED',
        is_completed: false,
        completed_at: null,
        priority_order: 1,
        blocker_reason: 'Waiting for GCP IAM role binding permissions approval from DevOps team.',
      },
    ],
  },
};

export const mockBacklogFixture: BacklogResponse = {
  tasks: [
    {
      id: 'task-backlog-1',
      user_id: 'user-sample-001',
      title: 'Add drag and drop support to execution board',
      description: 'Use @hello-pangea/dnd for fluid task reordering across columns.',
      is_completed: false,
      completed_at: null,
      is_archived: false,
      backlog_order: 1,
      created_at: '2026-08-28T10:00:00Z',
      updated_at: '2026-08-28T10:00:00Z',
    },
    {
      id: 'task-backlog-2',
      user_id: 'user-sample-001',
      title: 'Morning check-in rollover wizard UX',
      description: 'Modal wizard guiding user through yesterday review and today prioritization.',
      is_completed: false,
      completed_at: null,
      is_archived: false,
      backlog_order: 2,
      created_at: '2026-08-28T10:05:00Z',
      updated_at: '2026-08-28T10:05:00Z',
    },
  ],
};
