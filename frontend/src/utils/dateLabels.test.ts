import { describe, it, expect } from 'vitest';
import { getRelativeSectionLabels, getYesterdayDateHint } from './dateLabels';

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

describe('getYesterdayDateHint', () => {
  it('returns undefined when yesterday_date matches calendar yesterday', () => {
    expect(getYesterdayDateHint('2026-11-25', '2026-11-24')).toBeUndefined();
  });

  it('returns undefined when yesterday_date is absent', () => {
    expect(getYesterdayDateHint('2026-11-25', undefined)).toBeUndefined();
    expect(getYesterdayDateHint('2026-11-25', '')).toBeUndefined();
  });

  it('returns formatted date hint when yesterday_date is older than calendar yesterday', () => {
    expect(getYesterdayDateHint('2026-11-25', '2026-11-23')).toBe('Mon, Nov 23');
    expect(getYesterdayDateHint('2026-11-23', '2026-11-20')).toBe('Fri, Nov 20');
  });
});
