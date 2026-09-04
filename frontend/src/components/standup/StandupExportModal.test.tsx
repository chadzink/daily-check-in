import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StandupExportModal } from './StandupExportModal';
import { DaySessionWithTasks } from '../../types/domain';

describe('StandupExportModal Component', () => {
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
          title: 'Finished Milestone 4',
          description: '',
          status: 'YESTERDAY',
          is_completed: true,
          priority_order: 1,
        },
      ],
      today: [
        {
          day_task_id: 'dt-2',
          task_id: 't-2',
          title: 'Milestone 5 Calendar and Standup',
          description: '',
          status: 'TODAY',
          is_completed: false,
          priority_order: 1,
        },
      ],
      blocked: [
        {
          day_task_id: 'dt-3',
          task_id: 't-3',
          title: 'Cloud Run deployment',
          description: '',
          status: 'BLOCKED',
          is_completed: false,
          priority_order: 1,
          blocker_reason: 'Waiting for IAM permissions',
        },
      ],
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    // Stub clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders rich preview by default with structured sections', () => {
    render(
      <StandupExportModal
        isOpen={true}
        onClose={vi.fn()}
        sessionWithTasks={mockSession}
        dateStr="2026-09-04"
      />
    );

    expect(screen.getByText('Daily Standup Export')).toBeInTheDocument();
    expect(screen.getByTestId('standup-rich-preview')).toBeInTheDocument();
    expect(screen.getByText('Finished Milestone 4')).toBeInTheDocument();
    expect(screen.getByText('Milestone 5 Calendar and Standup')).toBeInTheDocument();
    expect(screen.getByText('Cloud Run deployment')).toBeInTheDocument();
    expect(screen.getByText(/Reason: Waiting for IAM permissions/)).toBeInTheDocument();
  });

  it('switches between Rich Preview and Markdown Code tabs', () => {
    render(
      <StandupExportModal
        isOpen={true}
        onClose={vi.fn()}
        sessionWithTasks={mockSession}
        dateStr="2026-09-04"
      />
    );

    const sourceTab = screen.getByTestId('standup-tab-source');
    fireEvent.click(sourceTab);

    const textarea = screen.getByTestId('standup-markdown-textarea') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toContain('**Yesterday:**');
    expect(textarea.value).toContain('- Finished Milestone 4');
    expect(textarea.value).toContain('**Today:**');
    expect(textarea.value).toContain('**Blocked:**');
  });

  it('copies formatted markdown to clipboard and shows confirmation', async () => {
    render(
      <StandupExportModal
        isOpen={true}
        onClose={vi.fn()}
        sessionWithTasks={mockSession}
        dateStr="2026-09-04"
      />
    );

    const copyBtn = screen.getByTestId('copy-standup-btn');
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('**Today:**')
    );
    expect(await screen.findByTestId('copied-confirmation')).toHaveTextContent('Copied to Clipboard!');
  });
});
