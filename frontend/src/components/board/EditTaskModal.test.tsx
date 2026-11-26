import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditTaskModal } from './EditTaskModal';

describe('EditTaskModal Component', () => {
  it('renders Move to Future Date picker in edit mode with context-aware helper text and Save & Move CTA', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    render(
      <EditTaskModal
        isOpen={true}
        mode="edit"
        initialTitle="Blocked API Task"
        initialDescription="Waiting on vendor"
        taskStatus="BLOCKED"
        currentDate="2026-11-26"
        todayDate="2026-11-26"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    const dateInput = screen.getByTestId('edit-task-move-date');
    expect(dateInput).toHaveAttribute('min', '2026-11-27');
    expect(
      screen.getByText(/Blocked tasks keep their Blocked status and blocker reason when moved/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    // Ensure no sub-task UI exists in EditTaskModal
    expect(screen.queryByText(/Add sub-task/i)).not.toBeInTheDocument();

    fireEvent.change(dateInput, { target: { value: '2026-11-28' } });
    expect(screen.getByRole('button', { name: 'Save & Move' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save & Move' }));
    expect(onConfirm).toHaveBeenCalledWith('Blocked API Task', 'Waiting on vendor', '2026-11-28');
  });

  it('validates past/today/same-day dates and allows clearing target date', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    render(
      <EditTaskModal
        isOpen={true}
        mode="edit"
        initialTitle="Today Task"
        taskStatus="TODAY"
        currentDate="2026-11-28"
        todayDate="2026-11-26"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    const dateInput = screen.getByTestId('edit-task-move-date');
    expect(
      screen.getByText(/Schedules this task onto the selected future date's Today list/i)
    ).toBeInTheDocument();

    // Selecting today should show inline error and disable submit
    fireEvent.change(dateInput, { target: { value: '2026-11-26' } });
    expect(screen.getByTestId('edit-task-move-date-error')).toHaveTextContent(
      /future date after today/i
    );
    expect(screen.getByRole('button', { name: 'Save & Move' })).toBeDisabled();

    // Selecting same date as currentDate should show inline error
    fireEvent.change(dateInput, { target: { value: '2026-11-28' } });
    expect(screen.getByTestId('edit-task-move-date-error')).toHaveTextContent(
      /already scheduled on this date/i
    );

    // Clear button resets selection and CTA
    await user.click(screen.getByTestId('edit-task-move-date-clear'));
    expect(dateInput).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
  });

  it('hides Move to Future Date picker in create mode', () => {
    render(
      <EditTaskModal
        isOpen={true}
        mode="create"
        targetLabel="Today"
        initialTitle=""
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByTestId('edit-task-move-date')).not.toBeInTheDocument();
  });
});
