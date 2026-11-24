import { describe, it, expect } from 'vitest';
import { buildCompletedTasksCsv, escapeCsvCell } from './csvExport';
import { CompletedTaskReportItem } from '../types/domain';

describe('csvExport utility', () => {
  it('escapes commas, quotes, and newlines per RFC 4180', () => {
    expect(escapeCsvCell('simple')).toBe('simple');
    expect(escapeCsvCell('hello, world')).toBe('"hello, world"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvCell(null)).toBe('');
  });

  it('builds CSV with all task report columns', () => {
    const items: CompletedTaskReportItem[] = [
      {
        day_task_id: 'dt-1',
        task_id: 't-1',
        date: '2026-11-24',
        title: 'Fix "backlog" bug',
        description: 'Exclude completed, archived items',
        status: 'TODAY',
        is_completed: true,
        completed_at: '2026-11-24T12:00:00Z',
        priority_order: 1,
        blocker_reason: '',
        created_at: '2026-11-24T09:00:00Z',
        updated_at: '2026-11-24T12:00:00Z',
      },
    ];

    const csv = buildCompletedTasksCsv(items);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      'date,day_task_id,task_id,title,description,status,is_completed,completed_at,priority_order,blocker_reason,created_at,updated_at'
    );
    expect(lines[1]).toContain('"Fix ""backlog"" bug"');
    expect(lines[1]).toContain('"Exclude completed, archived items"');
  });
});
