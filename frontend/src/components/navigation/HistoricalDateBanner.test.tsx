import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { HistoricalDateBanner } from './HistoricalDateBanner';
import { DateProvider, useDateContext } from '../../context/DateContext';

const ConsumerHelper: React.FC = () => {
  const { selectedDate } = useDateContext();
  return <div data-testid="active-date">{selectedDate}</div>;
};

describe('HistoricalDateBanner Component', () => {
  it('renders banner when viewing historical date and handles return to today', () => {
    render(
      <DateProvider initialDate="2020-01-01">
        <HistoricalDateBanner />
        <ConsumerHelper />
      </DateProvider>
    );

    const banner = screen.getByTestId('historical-date-banner');
    expect(banner).toBeInTheDocument();
    expect(screen.getByText(/Viewing Historical Session \(Read-Only\)/)).toBeInTheDocument();
    expect(screen.getByTestId('active-date')).toHaveTextContent('2020-01-01');

    const returnBtn = screen.getByTestId('return-to-today-btn');
    fireEvent.click(returnBtn);

    // Banner disappears after returning to today
    expect(screen.queryByTestId('historical-date-banner')).not.toBeInTheDocument();
    expect(screen.getByTestId('active-date')).not.toHaveTextContent('2020-01-01');
  });
});
