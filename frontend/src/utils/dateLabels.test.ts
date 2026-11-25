import { describe, it, expect } from 'vitest';
import { getRelativeSectionLabels } from './dateLabels';

describe('getRelativeSectionLabels', () => {
  it('returns Yesterday and Today when selectedDate matches referenceToday', () => {
    const result = getRelativeSectionLabels('2026-11-25', '2026-11-25');
    expect(result).toEqual({
      yesterdayLabel: 'Yesterday',
      todayLabel: 'Today',
      isCurrentDay: true,
    });
  });

  it('returns formatted calendar dates relative to selectedDate when viewing another day', () => {
    const result = getRelativeSectionLabels('2026-11-23', '2026-11-25');
    expect(result).toEqual({
      yesterdayLabel: 'Sunday, Nov 22, 2026',
      todayLabel: 'Monday, Nov 23, 2026',
      isCurrentDay: false,
    });
  });
});
