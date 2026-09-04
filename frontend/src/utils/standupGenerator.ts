import { DaySessionWithTasks, StandupExportOptions } from '../types/domain';

export const defaultStandupOptions: StandupExportOptions = {
  includeCompleted: true,
  includeBlockerReasons: true,
  bulletStyle: '-',
};

/**
 * Pure function formatting DaySessionWithTasks into standard Markdown for Slack / Teams / Email.
 */
export function generateStandupMarkdown(
  data?: DaySessionWithTasks | null,
  opts?: Partial<StandupExportOptions>
): string {
  const options: StandupExportOptions = { ...defaultStandupOptions, ...opts };
  const bullet = options.bulletStyle;

  const yesterdayTasks = data?.tasks?.yesterday || [];
  const todayTasks = data?.tasks?.today || [];
  const blockedTasks = data?.tasks?.blocked || [];

  const lines: string[] = [];

  // 1. Yesterday Section
  lines.push('**Yesterday:**');
  if (yesterdayTasks.length === 0) {
    lines.push(`${bullet} None`);
  } else {
    for (const task of yesterdayTasks) {
      lines.push(`${bullet} ${task.title}`);
    }
  }
  lines.push('');

  // 2. Today Section
  lines.push('**Today:**');
  // Filter today tasks if options.includeCompleted is false
  const filteredToday = options.includeCompleted
    ? todayTasks
    : todayTasks.filter((t) => !t.is_completed);

  if (filteredToday.length === 0) {
    lines.push(`${bullet} None`);
  } else {
    for (const task of filteredToday) {
      const checkbox = task.is_completed ? '[x]' : '[ ]';
      const priority = task.priority_order ? ` (Priority ${task.priority_order})` : '';
      lines.push(`${bullet} ${checkbox} ${task.title}${priority}`);
    }
  }
  lines.push('');

  // 3. Blocked Section
  lines.push('**Blocked:**');
  if (blockedTasks.length === 0) {
    lines.push(`${bullet} None`);
  } else {
    for (const task of blockedTasks) {
      if (options.includeBlockerReasons && task.blocker_reason) {
        lines.push(`${bullet} ${task.title} (${task.blocker_reason})`);
      } else {
        lines.push(`${bullet} ${task.title}`);
      }
    }
  }

  return lines.join('\n');
}
