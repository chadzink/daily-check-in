import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';

export interface DateContextValue {
  selectedDate: string; // YYYY-MM-DD
  today: string; // YYYY-MM-DD
  isToday: boolean;
  isHistorical: boolean;
  selectDate: (date: string) => void;
  jumpToToday: () => void;
}

const DateContext = createContext<DateContextValue | undefined>(undefined);

export const DateProvider: React.FC<{ children: React.ReactNode; initialDate?: string }> = ({
  children,
  initialDate,
}) => {
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayStr);

  const selectDate = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const jumpToToday = useCallback(() => {
    setSelectedDate(todayStr);
  }, [todayStr]);

  const value = useMemo<DateContextValue>(() => {
    const isToday = selectedDate === todayStr;
    const isHistorical = selectedDate < todayStr;
    return {
      selectedDate,
      today: todayStr,
      isToday,
      isHistorical,
      selectDate,
      jumpToToday,
    };
  }, [selectedDate, todayStr, selectDate, jumpToToday]);

  return <DateContext.Provider value={value}>{children}</DateContext.Provider>;
};

export function useDateContext(): DateContextValue {
  const context = useContext(DateContext);
  if (!context) {
    throw new Error('useDateContext must be used within a DateProvider');
  }
  return context;
}
