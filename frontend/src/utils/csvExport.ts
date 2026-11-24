import { CompletedTaskReportItem } from '../types/domain';

const CSV_HEADERS = [
  'date',
  'day_task_id',
  'task_id',
  'title',
  'description',
  'status',
  'is_completed',
  'completed_at',
  'priority_order',
  'blocker_reason',
  'created_at',
  'updated_at',
] as const;

export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCompletedTasksCsv(tasks: CompletedTaskReportItem[]): string {
  const rows = [
    CSV_HEADERS.join(','),
    ...tasks.map((task) =>
      [
        task.date,
        task.day_task_id,
        task.task_id,
        task.title,
        task.description,
        task.status,
        task.is_completed,
        task.completed_at ?? '',
        task.priority_order,
        task.blocker_reason ?? '',
        task.created_at ?? '',
        task.updated_at ?? '',
      ]
        .map(escapeCsvCell)
        .join(',')
    ),
  ];
  return rows.join('\r\n');
}

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
