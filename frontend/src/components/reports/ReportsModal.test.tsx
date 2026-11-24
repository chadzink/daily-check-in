import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { ReportsModal } from './ReportsModal';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('ReportsModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches completed tasks for date range and enables CSV export', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        start_date: '2026-11-18',
        end_date: '2026-11-24',
        total_count: 1,
        tasks: [
          {
            day_task_id: 'dt-1',
            task_id: 't-1',
            date: '2026-11-24',
            title: 'Completed Report Item',
            description: 'Full task details',
            status: 'TODAY',
            is_completed: true,
            completed_at: '2026-11-24T10:30:00Z',
            priority_order: 1,
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const createObjectUrlMock = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectUrlMock = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: createObjectUrlMock,
      revokeObjectURL: revokeObjectUrlMock,
    });

    const user = userEvent.setup();
    renderWithClient(<ReportsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Completed Report Item')).toBeInTheDocument();
      expect(screen.getByText('Full task details')).toBeInTheDocument();
    });

    const exportBtn = screen.getByTestId('export-csv-btn');
    expect(exportBtn).not.toBeDisabled();
    await user.click(exportBtn);

    expect(createObjectUrlMock).toHaveBeenCalled();
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:mock-url');
  });
});
