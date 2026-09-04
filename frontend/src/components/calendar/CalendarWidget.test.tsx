import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarWidget } from './CalendarWidget';
import { DateProvider } from '../../context/DateContext';

function renderWidget(initialDate: string = '2026-09-04') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DateProvider initialDate={initialDate}>
        <CalendarWidget />
      </DateProvider>
    </QueryClientProvider>
  );
}

describe('CalendarWidget Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          month: '2026-09',
          days: [
            {
              date: '2026-09-01',
              has_session: true,
              has_check_in: true,
              has_check_out: true,
              completed_task_count: 3,
              total_task_count: 3,
            },
            {
              date: '2026-09-02',
              has_session: true,
              has_check_in: true,
              has_check_out: false,
              completed_task_count: 1,
              total_task_count: 2,
            },
          ],
        }),
      })
    );
  });

  it('renders toggle button and opens calendar popover when clicked', () => {
    renderWidget('2026-09-04');
    const toggle = screen.getByTestId('calendar-widget-toggle');
    expect(toggle).toBeInTheDocument();

    expect(screen.queryByTestId('calendar-popover')).not.toBeInTheDocument();
    fireEvent.click(toggle);

    expect(screen.getByTestId('calendar-popover')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-month-heading')).toHaveTextContent('September 2026');
  });

  it('navigates to previous and next month', () => {
    renderWidget('2026-09-04');
    fireEvent.click(screen.getByTestId('calendar-widget-toggle'));

    const prevBtn = screen.getByTestId('calendar-prev-month');
    const nextBtn = screen.getByTestId('calendar-next-month');

    // Go to August
    fireEvent.click(prevBtn);
    expect(screen.getByTestId('calendar-month-heading')).toHaveTextContent('August 2026');

    // Go to September then October
    fireEvent.click(nextBtn);
    expect(screen.getByTestId('calendar-month-heading')).toHaveTextContent('September 2026');
    fireEvent.click(nextBtn);
    expect(screen.getByTestId('calendar-month-heading')).toHaveTextContent('October 2026');
  });

  it('selects a date when a day cell is clicked', () => {
    renderWidget('2026-09-04');
    fireEvent.click(screen.getByTestId('calendar-widget-toggle'));

    const day1Cell = screen.getByTestId('calendar-cell-2026-09-01');
    expect(day1Cell).toBeInTheDocument();

    fireEvent.click(day1Cell);
    // Popover closes on select
    expect(screen.queryByTestId('calendar-popover')).not.toBeInTheDocument();
  });
});
