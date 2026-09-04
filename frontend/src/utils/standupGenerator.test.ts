import { describe, it, expect } from 'vitest';
import { generateStandupMarkdown } from './standupGenerator';
import { DaySessionWithTasks, DayTaskWithDetails } from '../types/domain';

describe('generateStandupMarkdown', () => {
  const mockSession: DaySessionWithTasks = {
    session: {
      id: '2026-09-04',
      user_id: 'user-1',
      date: '2026-09-04',
      check_in_at: '2026-09-04T09:00:00Z',
      check_out_at: null,
      notes: '',
      created_at: '2026-09-04T08:00:00Z',
      updated_at: '2026-09-04T09:00:00Z',
    },
    tasks: {
      yesterday: [
        {
          day_task_id: 'dt-1',
          task_id: 't-1',
          title: 'Completed auth endpoints',
          description: '',
          status: 'YESTERDAY',
          is_completed: true,
          priority_order: 1,
        } as DayTaskWithDetails,
      ],
      today: [
        {
          day_task_id: 'dt-2',
          task_id: 't-2',
          title: 'Implement Calendar Widget',
          description: '',
          status: 'TODAY',
          is_completed: false,
          priority_order: 1,
        } as DayTaskWithDetails,
        {
          day_task_id: 'dt-3',
          task_id: 't-3',
          title: 'Fix drag-and-drop bug',
          description: '',
          status: 'TODAY',
          is_completed: true,
          priority_order: 2,
        } as DayTaskWithDetails,
      ],
      blocked: [
        {
          day_task_id: 'dt-4',
          task_id: 't-4',
          title: 'Staging Database Migration',
          description: '',
          status: 'BLOCKED',
          is_completed: false,
          priority_order: 1,
          blocker_reason: 'Waiting on DevOps permissions',
        } as DayTaskWithDetails,
      ],
    },
  };

  it('generates standard markdown with yesterday, today, and blocked sections', () => {
    const markdown = generateStandupMarkdown(mockSession);
    expect(markdown).toContain('**Yesterday:**');
    expect(markdown).toContain('- Completed auth endpoints');
    expect(markdown).toContain('**Today:**');
    expect(markdown).toContain('- [ ] Implement Calendar Widget (Priority 1)');
    expect(markdown).toContain('- [x] Fix drag-and-drop bug (Priority 2)');
    expect(markdown).toContain('**Blocked:**');
    expect(markdown).toContain('- Staging Database Migration (Waiting on DevOps permissions)');
  });

  it('handles empty sessions gracefully', () => {
    const markdown = generateStandupMarkdown(null);
    expect(markdown).toContain('**Yesterday:**\n- None');
    expect(markdown).toContain('**Today:**\n- None');
    expect(markdown).toContain('**Blocked:**\n- None');
  });

  it('respects includeCompleted = false option', () => {
    const markdown = generateStandupMarkdown(mockSession, { includeCompleted: false });
    expect(markdown).toContain('- [ ] Implement Calendar Widget (Priority 1)');
    expect(markdown).not.toContain('- [x] Fix drag-and-drop bug (Priority 2)');
  });

  it('respects includeBlockerReasons = false option', () => {
    const markdown = generateStandupMarkdown(mockSession, { includeBlockerReasons: false });
    expect(markdown).toContain('- Staging Database Migration');
    expect(markdown).not.toContain('Waiting on DevOps permissions');
  });

  it('respects custom bullet style (*)', () => {
    const markdown = generateStandupMarkdown(mockSession, { bulletStyle: '*' });
    expect(markdown).toContain('* Completed auth endpoints');
  });
});
